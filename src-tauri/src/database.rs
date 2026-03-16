use crate::types::{BioScan, GameEvent, SystemBody, SystemStats, SystemVisit};
use rusqlite::{params, Connection};
use serde_json::Value;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

pub fn db_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to resolve app data dir")
        .join("chronicle.db")
}

pub fn init_database(path: &PathBuf) -> Connection {
    let conn = Connection::open(path).expect("failed to open database");
    conn.execute_batch("PRAGMA journal_mode = WAL;")
        .expect("failed to set WAL mode");

    // Migrations — wrapped in unwrap_or to ignore "already exists" errors
    let _ = conn.execute("ALTER TABLE events ADD COLUMN commander TEXT", []);
    let _ = conn.execute("ALTER TABLE bodies ADD COLUMN parent_body_id INTEGER", []);
    let _ = conn.execute("ALTER TABLE bodies ADD COLUMN parent_body_type TEXT", []);
    let _ = conn.execute("ALTER TABLE bodies ADD COLUMN terraform_state TEXT", []);
    let _ = conn.execute("ALTER TABLE bodies ADD COLUMN scan_value INTEGER", []);
    let _ = conn.execute(
        "ALTER TABLE star_systems ADD COLUMN estimated_scan_value INTEGER NOT NULL DEFAULT 0",
        [],
    );
    let _ = conn.execute("ALTER TABLE bodies ADD COLUMN star_type TEXT", []);
    let _ = conn.execute(
        "ALTER TABLE bodies ADD COLUMN biological_signals INTEGER",
        [],
    );
    let _ = conn.execute("ALTER TABLE star_systems ADD COLUMN x REAL", []);
    let _ = conn.execute("ALTER TABLE star_systems ADD COLUMN y REAL", []);
    let _ = conn.execute("ALTER TABLE star_systems ADD COLUMN z REAL", []);
    let _ = conn.execute(
        "ALTER TABLE bodies ADD COLUMN atmosphere_composition TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE star_systems ADD COLUMN ammonia_worlds INTEGER NOT NULL DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE star_systems ADD COLUMN earthlike_worlds INTEGER NOT NULL DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE star_systems ADD COLUMN water_worlds INTEGER NOT NULL DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE star_systems ADD COLUMN terraformable_planets INTEGER NOT NULL DEFAULT 0",
        [],
    );

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS events (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            type      TEXT    NOT NULL,
            timestamp TEXT    NOT NULL,
            data      TEXT    NOT NULL,
            commander TEXT
        );

        CREATE TABLE IF NOT EXISTS star_systems (
            system_address        INTEGER PRIMARY KEY,
            system_name           TEXT    NOT NULL,
            star_class            TEXT    NOT NULL,
            body_count            INTEGER,
            non_body_count        INTEGER,
            all_bodies_found      INTEGER NOT NULL,
            estimated_scan_value  INTEGER NOT NULL DEFAULT 0,
            x                     REAL,
            y                     REAL,
            z                     REAL,
            ammonia_worlds        INTEGER NOT NULL DEFAULT 0,
            earthlike_worlds      INTEGER NOT NULL DEFAULT 0,
            water_worlds          INTEGER NOT NULL DEFAULT 0,
            terraformable_planets INTEGER NOT NULL DEFAULT 0,
            UNIQUE(system_address, system_name)
        );

        CREATE TABLE IF NOT EXISTS commanders (
            fid            TEXT PRIMARY KEY,
            name           TEXT NOT NULL,
            current_system INTEGER
        );

        CREATE TABLE IF NOT EXISTS bodies (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            system_address  INTEGER NOT NULL,
            body_id         INTEGER NOT NULL,
            body_name       TEXT    NOT NULL,
            body_type       TEXT    NOT NULL,
            distance        REAL    NOT NULL,

            sub_class       INTEGER,
            star_type       TEXT,
            mass            REAL,
            radius          REAL,
            age             INTEGER,
            surface_temp    REAL,
            luminosity      TEXT,

            planet_class            TEXT,
            atmosphere              TEXT,
            atmosphere_type         TEXT,
            atmosphere_composition  TEXT,
            volcanism               TEXT,
            gravity                 REAL,
            pressure                REAL,
            landable                INTEGER,
            terraform_state         TEXT,

            parent_body_id    INTEGER,
            parent_body_type  TEXT,

            discovered_by       TEXT,
            mapped_by           TEXT,
            footfall_by         TEXT,
            scan_value          INTEGER,
            biological_signals  INTEGER,
            UNIQUE(body_name)
        );

        CREATE TABLE IF NOT EXISTS systems_visited (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            system_address INTEGER NOT NULL,
            visited_at     TEXT    NOT NULL,
            UNIQUE(visited_at)
        );
        ",
    )
    .expect("failed to create tables");

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS bio_scans (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            system_address INTEGER NOT NULL,
            body_id        INTEGER NOT NULL,
            body_name      TEXT,
            genus          TEXT NOT NULL,
            species        TEXT,
            variant        TEXT,
            status         TEXT NOT NULL DEFAULT 'genus',
            first_found    INTEGER NOT NULL DEFAULT 0,
            base_value     INTEGER,
            commander_fid  TEXT,
            updated_at     TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bio_scans_species_idx
            ON bio_scans(system_address, body_id, species)
            WHERE species IS NOT NULL;
        ",
    )
    .expect("failed to create bio_scans table");

    // Backfill systems_visited from FSDJump events
    conn.execute_batch(
        "
        INSERT OR IGNORE INTO systems_visited (system_address, visited_at)
        SELECT json_extract(data, '$.SystemAddress'), json_extract(data, '$.timestamp')
        FROM events
        WHERE type = 'FSDJump'
          AND json_extract(data, '$.SystemAddress') IS NOT NULL
          AND json_extract(data, '$.timestamp')     IS NOT NULL
        ORDER BY id ASC
        ",
    )
    .ok();

    // Replay scan events for the last commander's current system
    let last_system: Option<i64> = conn
        .query_row(
            "SELECT current_system FROM commanders ORDER BY rowid DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok()
        .flatten();
    if let Some(system_address) = last_system {
        replay_scan_events_for_system(&conn, system_address);
    }

    conn
}

fn process_fss_discovery_scan(conn: &Connection, d: &Value) {
    let system_address = d["SystemAddress"].as_i64();
    let body_count = d["BodyCount"].as_i64();
    let non_body_count = d["NonBodyCount"].as_i64();
    if let (Some(sa), Some(bc), Some(nbc)) = (system_address, body_count, non_body_count) {
        conn.execute(
            "UPDATE star_systems SET body_count = ?1, non_body_count = ?2 WHERE system_address = ?3",
            params![bc, nbc, sa],
        )
        .ok();
    }
}

fn process_fss_body_signals(conn: &Connection, d: &Value) {
    let body_name = match d["BodyName"].as_str() {
        Some(s) => s,
        None => return,
    };
    let signals = match d["Signals"].as_array() {
        Some(s) => s,
        None => return,
    };

    let mut bio_count: i64 = 0;
    for signal in signals {
        if let Some(sig_type) = signal["Type"].as_str() {
            if sig_type.to_lowercase().contains("biological") {
                bio_count += signal["Count"].as_i64().unwrap_or(0);
            }
        }
    }

    conn.execute(
        "UPDATE bodies SET biological_signals = ?1 WHERE body_name = ?2",
        params![bio_count, body_name],
    )
    .ok();
}

fn lookup_body_name(conn: &Connection, system_address: i64, body_id: i64) -> Option<String> {
    conn.query_row(
        "SELECT body_name FROM bodies WHERE system_address = ?1 AND body_id = ?2 LIMIT 1",
        params![system_address, body_id],
        |row| row.get(0),
    )
    .ok()
}

fn process_saa_signals_found(conn: &Connection, d: &Value, commander_fid: Option<&str>) {
    let system_address = match d["SystemAddress"].as_i64() { Some(v) => v, None => return };
    let body_id        = match d["BodyID"].as_i64()         { Some(v) => v, None => return };
    let updated_at     = d["timestamp"].as_str().unwrap_or("");
    let genuses        = match d["Genuses"].as_array()      { Some(v) => v, None => return };

    let body_name = lookup_body_name(conn, system_address, body_id);

    for genus_entry in genuses {
        let genus = match genus_entry["Genus_Localised"].as_str() {
            Some(g) if !g.is_empty() => g,
            _ => continue,
        };

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM bio_scans WHERE system_address = ?1 AND body_id = ?2 AND genus = ?3",
                params![system_address, body_id, genus],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if count == 0 {
            conn.execute(
                "INSERT INTO bio_scans (system_address, body_id, body_name, genus, status, commander_fid, updated_at)
                 VALUES (?1, ?2, ?3, ?4, 'genus', ?5, ?6)",
                params![system_address, body_id, body_name, genus, commander_fid, updated_at],
            )
            .ok();
        }
    }
}

fn process_scan_organic(conn: &Connection, d: &Value, commander_fid: Option<&str>) {
    let system_address = match d["SystemAddress"].as_i64()         { Some(v) => v, None => return };
    let body_id        = match d["Body"].as_i64()                  { Some(v) => v, None => return };
    let genus          = match d["Genus_Localised"].as_str()        { Some(v) => v, None => return };
    let species        = match d["Species_Localised"].as_str()      { Some(v) => v, None => return };
    let variant        = d["Variant_Localised"].as_str();
    let scan_type      = d["ScanType"].as_str().unwrap_or("Log");
    let updated_at     = d["timestamp"].as_str().unwrap_or("");

    let status = match scan_type {
        "Analyse" => "complete",
        _ => "collecting",
    };

    // Step 1: try to upgrade an existing genus-only row
    conn.execute(
        "UPDATE bio_scans
         SET species = ?1, variant = COALESCE(?2, variant), status = ?3,
             commander_fid = COALESCE(commander_fid, ?4), updated_at = ?5
         WHERE id = (
             SELECT id FROM bio_scans
             WHERE system_address = ?6 AND body_id = ?7 AND genus = ?8 AND species IS NULL
             ORDER BY id LIMIT 1
         )",
        params![species, variant, status, commander_fid, updated_at,
                system_address, body_id, genus],
    )
    .ok();

    // Step 2: if no genus-only row was found, upsert by species
    if conn.changes() == 0 {
        let body_name = lookup_body_name(conn, system_address, body_id);
        conn.execute(
            "INSERT INTO bio_scans (system_address, body_id, body_name, genus, species, variant, status, commander_fid, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(system_address, body_id, species) WHERE species IS NOT NULL DO UPDATE SET
                 status     = CASE WHEN excluded.status = 'complete' THEN 'complete' ELSE bio_scans.status END,
                 variant    = COALESCE(excluded.variant, bio_scans.variant),
                 updated_at = excluded.updated_at",
            params![system_address, body_id, body_name, genus, species, variant, status, commander_fid, updated_at],
        )
        .ok();
    }

    // Belt-and-suspenders: Analyse scans always force status to 'complete'
    if status == "complete" {
        conn.execute(
            "UPDATE bio_scans SET status = 'complete', updated_at = ?1
             WHERE system_address = ?2 AND body_id = ?3 AND species = ?4",
            params![updated_at, system_address, body_id, species],
        )
        .ok();
    }
}

pub fn process_disembark_footfall(conn: &Connection, d: &Value, commander_name: &str) {
    if d["OnPlanet"].as_bool() != Some(true) { return; }
    let body_name = match d["Body"].as_str() { Some(v) => v, None => return };

    let already_claimed: bool = conn
        .query_row(
            "SELECT footfall_by IS NOT NULL FROM bodies WHERE body_name = ?1 LIMIT 1",
            params![body_name],
            |row| row.get(0),
        )
        .unwrap_or(true);
    if already_claimed { return; }

    conn.execute(
        "UPDATE bodies SET footfall_by = ?1 WHERE body_name = ?2 AND footfall_by IS NULL",
        params![commander_name, body_name],
    )
    .ok();

    if let Some((sa, bid)) = conn
        .query_row(
            "SELECT system_address, body_id FROM bodies WHERE body_name = ?1 LIMIT 1",
            params![body_name],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
        )
        .ok()
    {
        conn.execute(
            "UPDATE bio_scans SET first_found = 1 WHERE system_address = ?1 AND body_id = ?2",
            params![sa, bid],
        )
        .ok();
    }
}

fn get_base_star_scan_value(star_type: &str) -> i64 {
    match star_type {
        "D" | "DA" | "DAB" | "DAO" | "DAZ" | "DAV" | "DB" | "DBZ" | "DO" | "DOV" | "DQ"
        | "DC" | "DCV" | "DX" => 14057,
        "N" | "H" => 22628,
        _ => 1200,
    }
}

fn get_base_planet_scan_value(body_class: &str, terraformable: bool) -> i64 {
    match body_class.to_lowercase().as_str() {
        "ammonia world" => 96932,
        "earthlike body" => 64831 + 116295,
        "water world" => {
            let mut k = 64831i64;
            if terraformable {
                k += 116295;
            }
            k
        }
        "metal rich body" => {
            let mut k = 21790i64;
            if terraformable {
                k += 65631;
            }
            k
        }
        "sudarsky class ii gas giant" | "high metal content body" => {
            let mut k = 9654i64;
            if terraformable {
                k += 100677;
            }
            k
        }
        "sudarsky class i gas giant" => 1656,
        _ => {
            let mut k = 300i64;
            if terraformable {
                k += 93328;
            }
            k
        }
    }
}

fn estimate_body_scan_value(
    k: i64,
    mass: f64,
    is_first_discoverer: bool,
    is_mapped: bool,
    is_first_mapped: bool,
    with_efficiency_bonus: bool,
) -> i64 {
    let q = 0.56591828_f64;
    let mapping_multiplier = if is_mapped {
        if is_first_discoverer && is_first_mapped {
            3.699622554_f64
        } else if is_first_mapped {
            8.0956_f64
        } else {
            3.3333333333_f64
        }
    } else {
        1.0_f64
    };

    let mut value = (k as f64 + k as f64 * q * mass.powf(0.2)) * mapping_multiplier;
    if is_mapped {
        let bonus = value * 0.3;
        value += if bonus > 555.0 { bonus } else { 555.0 };
        if with_efficiency_bonus {
            value *= 1.25;
        }
    }

    value = value.max(500.0);
    if is_first_discoverer {
        value *= 2.6;
    }

    value.round() as i64
}

fn process_body_scan(conn: &Connection, d: &Value) {
    let system_address = match d["SystemAddress"].as_i64() {
        Some(v) => v,
        None => return,
    };
    let body_id = match d["BodyID"].as_i64() {
        Some(v) => v,
        None => return,
    };
    let body_name = match d["BodyName"].as_str() {
        Some(v) => v,
        None => return,
    };
    let distance = match d["DistanceFromArrivalLS"].as_f64() {
        Some(v) => v,
        None => return,
    };

    let was_discovered = d["WasDiscovered"].as_bool().unwrap_or(false);
    let was_mapped = d["WasMapped"].as_bool().unwrap_or(false);

    let is_star = d["StarType"].is_string();

    // Parse parent from Parents array
    let mut parent_body_id: Option<i64> = None;
    let mut parent_body_type: Option<String> = None;
    if let Some(parents) = d["Parents"].as_array() {
        if let Some(first) = parents.first() {
            if let Some(obj) = first.as_object() {
                if let Some((key, val)) = obj.iter().next() {
                    parent_body_id = val.as_i64();
                    parent_body_type = Some(key.clone());
                }
            }
        }
    }

    let (body_type, scan_value) = if is_star {
        let star_type = d["StarType"].as_str().unwrap_or("");
        let k = get_base_star_scan_value(star_type);
        let mass = d["StellarMass"].as_f64().unwrap_or(1.0);
        let sv = estimate_body_scan_value(k, mass, !was_discovered, false, !was_mapped, true);
        ("Star".to_string(), sv)
    } else if d["PlanetClass"].is_string() {
        let planet_class = d["PlanetClass"].as_str().unwrap_or("");
        let terraformable = d["TerraformState"].as_str() == Some("Terraformable");
        let k = get_base_planet_scan_value(planet_class, terraformable);
        let mass = d["MassEM"].as_f64().unwrap_or(1.0);
        let sv = estimate_body_scan_value(k, mass, !was_discovered, false, !was_mapped, true);
        ("Planet".to_string(), sv)
    } else {
        ("Unknown".to_string(), 0)
    };

    let atm_comp = if d["AtmosphereComposition"].is_array() {
        Some(d["AtmosphereComposition"].to_string())
    } else {
        None
    };

    let mass = if is_star {
        d["StellarMass"].as_f64()
    } else {
        d["MassEM"].as_f64()
    };

    conn.execute(
        "INSERT INTO bodies (
            system_address, body_id, body_name, body_type, distance,
            sub_class, star_type, mass, radius, age, surface_temp, luminosity,
            planet_class, atmosphere, atmosphere_type, atmosphere_composition, volcanism,
            gravity, pressure, landable, terraform_state,
            parent_body_id, parent_body_type, scan_value
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)
        ON CONFLICT(body_name) DO UPDATE SET
            body_type               = excluded.body_type,
            distance                = excluded.distance,
            sub_class               = excluded.sub_class,
            star_type               = excluded.star_type,
            mass                    = excluded.mass,
            radius                  = excluded.radius,
            age                     = excluded.age,
            surface_temp            = excluded.surface_temp,
            luminosity              = excluded.luminosity,
            planet_class            = excluded.planet_class,
            atmosphere              = excluded.atmosphere,
            atmosphere_type         = excluded.atmosphere_type,
            atmosphere_composition  = excluded.atmosphere_composition,
            volcanism               = excluded.volcanism,
            gravity                 = excluded.gravity,
            pressure                = excluded.pressure,
            landable                = excluded.landable,
            terraform_state         = excluded.terraform_state,
            parent_body_id          = excluded.parent_body_id,
            parent_body_type        = excluded.parent_body_type,
            scan_value              = excluded.scan_value",
        params![
            system_address,
            body_id,
            body_name,
            body_type,
            distance,
            d["Subclass"].as_i64(),
            d["StarType"].as_str(),
            mass,
            d["Radius"].as_f64(),
            d["Age_MY"].as_i64(),
            d["SurfaceTemperature"].as_f64(),
            d["Luminosity"].as_str(),
            d["PlanetClass"].as_str(),
            d["Atmosphere"].as_str(),
            d["AtmosphereType"].as_str(),
            atm_comp,
            d["Volcanism"].as_str(),
            d["SurfaceGravity"].as_f64(),
            d["SurfacePressure"].as_f64(),
            d["Landable"].as_bool().map(|b| if b { 1i64 } else { 0i64 }),
            d["TerraformState"].as_str(),
            parent_body_id,
            parent_body_type,
            scan_value,
        ],
    )
    .ok();

    conn.execute(
        "UPDATE star_systems
         SET estimated_scan_value = (
             SELECT COALESCE(SUM(scan_value), 0)
             FROM bodies
             WHERE system_address = ?1 AND body_type NOT IN ('Barycenter', 'Unknown')
         )
         WHERE system_address = ?1",
        params![system_address],
    )
    .ok();

    conn.execute(
        "UPDATE star_systems SET
            ammonia_worlds        = (SELECT COUNT(*) FROM bodies WHERE system_address = ?1 AND LOWER(planet_class) = 'ammonia world'),
            earthlike_worlds      = (SELECT COUNT(*) FROM bodies WHERE system_address = ?1 AND LOWER(planet_class) = 'earthlike body'),
            water_worlds          = (SELECT COUNT(*) FROM bodies WHERE system_address = ?1 AND LOWER(planet_class) = 'water world'),
            terraformable_planets = (SELECT COUNT(*) FROM bodies WHERE system_address = ?1 AND terraform_state = 'Terraformable')
         WHERE system_address = ?1",
        params![system_address],
    )
    .ok();

    // Insert barycenter when first seen as a Null parent
    if parent_body_type.as_deref() == Some("Null") {
        if let Some(pid) = parent_body_id {
            conn.execute(
                "INSERT OR IGNORE INTO bodies (system_address, body_id, body_name, body_type, distance)
                 VALUES (?1, ?2, ?3, 'Barycenter', 0)",
                params![system_address, pid, format!("$bc:{}:{}", system_address, pid)],
            )
            .ok();
        }
    }
}

fn replay_scan_events_for_system(conn: &Connection, system_address: i64) {
    // Replay FSSDiscoveryScan
    let fss_rows: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT data FROM events WHERE type = 'FSSDiscoveryScan'
                 AND json_extract(data, '$.SystemAddress') = ?1 ORDER BY id ASC",
            )
            .unwrap();
        stmt.query_map(params![system_address], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };
    for data_str in &fss_rows {
        if let Ok(d) = serde_json::from_str::<Value>(data_str) {
            process_fss_discovery_scan(conn, &d);
        }
    }

    // Replay Scan
    let scan_rows: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT data FROM events WHERE type = 'Scan'
                 AND json_extract(data, '$.SystemAddress') = ?1 ORDER BY id ASC",
            )
            .unwrap();
        stmt.query_map(params![system_address], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };
    for data_str in &scan_rows {
        if let Ok(d) = serde_json::from_str::<Value>(data_str) {
            process_body_scan(conn, &d);
        }
    }

    // Replay FSSBodySignals
    let bio_rows: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT data FROM events WHERE type = 'FSSBodySignals'
                 AND json_extract(data, '$.SystemAddress') = ?1 ORDER BY id ASC",
            )
            .unwrap();
        stmt.query_map(params![system_address], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };
    for data_str in &bio_rows {
        if let Ok(d) = serde_json::from_str::<Value>(data_str) {
            process_fss_body_signals(conn, &d);
        }
    }

    replay_bio_scan_events_for_system(conn, system_address);
}

fn replay_bio_scan_events_for_system(conn: &Connection, system_address: i64) {
    // Replay SAASignalsFound
    let rows: Vec<(String, Option<String>)> = {
        let mut stmt = conn
            .prepare(
                "SELECT data, commander FROM events WHERE type = 'SAASignalsFound'
                 AND json_extract(data, '$.SystemAddress') = ?1 ORDER BY id ASC",
            )
            .unwrap();
        stmt.query_map(params![system_address], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };
    for (data_str, cmdr) in &rows {
        if let Ok(d) = serde_json::from_str::<Value>(data_str) {
            process_saa_signals_found(conn, &d, cmdr.as_deref());
        }
    }

    // Replay ScanOrganic
    let rows: Vec<(String, Option<String>)> = {
        let mut stmt = conn
            .prepare(
                "SELECT data, commander FROM events WHERE type = 'ScanOrganic'
                 AND json_extract(data, '$.SystemAddress') = ?1 ORDER BY id ASC",
            )
            .unwrap();
        stmt.query_map(params![system_address], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };
    for (data_str, cmdr) in &rows {
        if let Ok(d) = serde_json::from_str::<Value>(data_str) {
            process_scan_organic(conn, &d, cmdr.as_deref());
        }
    }

    // Replay Disembark (first footfall)
    let rows: Vec<(String, String)> = {
        let mut stmt = conn
            .prepare(
                "SELECT e.data, c.name
                 FROM events e
                 JOIN commanders c ON c.fid = e.commander
                 WHERE e.type = 'Disembark'
                   AND json_extract(e.data, '$.OnPlanet') = 1
                   AND EXISTS (
                       SELECT 1 FROM bodies b
                       WHERE b.body_name = json_extract(e.data, '$.Body')
                         AND b.system_address = ?1
                   )
                 ORDER BY e.id ASC",
            )
            .unwrap();
        stmt.query_map(params![system_address], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };
    for (data_str, cmdr_name) in &rows {
        if let Ok(d) = serde_json::from_str::<Value>(data_str) {
            process_disembark_footfall(conn, &d, cmdr_name);
        }
    }
}

pub fn insert_event(conn: &Connection, event: &GameEvent, commander_fid: Option<&str>) {
    let timestamp = event
        .data
        .get("timestamp")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    conn.execute(
        "INSERT INTO events (type, timestamp, data, commander) VALUES (?1, ?2, ?3, ?4)",
        params![event.event_type, timestamp, event.raw, commander_fid],
    )
    .ok();

    if event.event_type == "FSDTarget" {
        let sa = event.data["SystemAddress"].as_i64();
        let name = event.data["Name"].as_str();
        let star_class = event.data["StarClass"].as_str();
        if let (Some(sa), Some(name), Some(sc)) = (sa, name, star_class) {
            conn.execute(
                "INSERT OR IGNORE INTO star_systems (system_address, system_name, star_class, all_bodies_found)
                 VALUES (?1, ?2, ?3, 0)",
                params![sa, name, sc],
            )
            .ok();
        }
    }

    if event.event_type == "StartJump" {
        let sa = event.data["SystemAddress"].as_i64();
        let name = event.data["StarSystem"].as_str();
        let star_class = event.data["StarClass"].as_str();
        if let (Some(sa), Some(name), Some(sc)) = (sa, name, star_class) {
            conn.execute(
                "INSERT OR IGNORE INTO star_systems (system_address, system_name, star_class, all_bodies_found)
                 VALUES (?1, ?2, ?3, 0)",
                params![sa, name, sc],
            )
            .ok();
        }
    }

    if event.event_type == "FSDJump" {
        let sa = event.data["SystemAddress"].as_i64();
        let name = event.data["StarSystem"].as_str();
        let star_class = event.data["StarClass"].as_str();
        if let (Some(sa), Some(name), Some(sc)) = (sa, name, star_class) {
            let star_pos = &event.data["StarPos"];
            let x = star_pos.get(0).and_then(|v| v.as_f64());
            let y = star_pos.get(1).and_then(|v| v.as_f64());
            let z = star_pos.get(2).and_then(|v| v.as_f64());

            conn.execute(
                "INSERT INTO star_systems (system_address, system_name, star_class, all_bodies_found, x, y, z)
                 VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6)
                 ON CONFLICT(system_address) DO UPDATE SET
                   star_class = excluded.star_class,
                   x = COALESCE(excluded.x, star_systems.x),
                   y = COALESCE(excluded.y, star_systems.y),
                   z = COALESCE(excluded.z, star_systems.z)",
                params![sa, name, sc, x, y, z],
            )
            .ok();
            conn.execute(
                "INSERT OR IGNORE INTO systems_visited (system_address, visited_at) VALUES (?1, ?2)",
                params![sa, timestamp],
            )
            .ok();
        }
    }

    if event.event_type == "FSSDiscoveryScan" {
        process_fss_discovery_scan(conn, &event.data);
    }

    if event.event_type == "Scan" {
        process_body_scan(conn, &event.data);
    }

    if event.event_type == "FSSBodySignals" {
        process_fss_body_signals(conn, &event.data);
    }

    if event.event_type == "SAASignalsFound" {
        process_saa_signals_found(conn, &event.data, commander_fid);
    }

    if event.event_type == "ScanOrganic" {
        process_scan_organic(conn, &event.data, commander_fid);
    }

}

pub fn get_all_events(conn: &Connection) -> Vec<GameEvent> {
    let mut stmt = conn
        .prepare(
            "SELECT id, type, data, commander FROM events ORDER BY id DESC LIMIT 100",
        )
        .unwrap();

    let mut rows: Vec<GameEvent> = stmt
        .query_map([], |row| {
            let id: i64 = row.get(0)?;
            let event_type: String = row.get(1)?;
            let data_str: String = row.get(2)?;
            let commander: Option<String> = row.get(3)?;
            Ok((id, event_type, data_str, commander))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .map(|(id, event_type, data_str, commander)| {
            let data: Value = serde_json::from_str(&data_str).unwrap_or(Value::Null);
            GameEvent {
                _id: format!("db-{}", id),
                event_type,
                raw: data_str,
                data,
                commander,
            }
        })
        .collect();

    rows.reverse();
    rows
}

pub fn upsert_commander(conn: &Connection, fid: &str, name: &str) {
    conn.execute(
        "INSERT INTO commanders (fid, name) VALUES (?1, ?2)
         ON CONFLICT(fid) DO UPDATE SET name = excluded.name",
        params![fid, name],
    )
    .ok();
}

pub fn get_last_commander(
    conn: &Connection,
) -> Option<(String, String, Option<i64>, Option<String>)> {
    conn.query_row(
        "SELECT c.fid, c.name, c.current_system, s.system_name
         FROM commanders c
         LEFT JOIN star_systems s ON s.system_address = c.current_system
         ORDER BY c.rowid DESC LIMIT 1",
        [],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<i64>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        },
    )
    .ok()
}

pub fn upsert_system_from_location(
    conn: &Connection,
    system_address: i64,
    system_name: &str,
    x: Option<f64>,
    y: Option<f64>,
    z: Option<f64>,
) {
    conn.execute(
        "INSERT INTO star_systems (system_address, system_name, star_class, all_bodies_found, x, y, z)
         VALUES (?1, ?2, '', 0, ?3, ?4, ?5)
         ON CONFLICT(system_address) DO UPDATE SET
           x = COALESCE(excluded.x, star_systems.x),
           y = COALESCE(excluded.y, star_systems.y),
           z = COALESCE(excluded.z, star_systems.z)",
        params![system_address, system_name, x, y, z],
    )
    .ok();
}

pub fn update_commander_system(conn: &Connection, fid: &str, system_address: i64) {
    conn.execute(
        "UPDATE commanders SET current_system = ?1 WHERE fid = ?2",
        params![system_address, fid],
    )
    .ok();
}

pub fn mark_all_bodies_found(conn: &Connection, system_address: i64) {
    conn.execute(
        "UPDATE star_systems SET all_bodies_found = 1 WHERE system_address = ?1",
        params![system_address],
    )
    .ok();
}

pub fn update_body_discovered_by(conn: &Connection, body_name: &str, commander_name: &str) {
    conn.execute(
        "UPDATE bodies SET discovered_by = ?1 WHERE body_name = ?2",
        params![commander_name, body_name],
    )
    .ok();
}

pub fn update_body_mapped_by(conn: &Connection, body_name: &str, commander_name: &str) {
    conn.execute(
        "UPDATE bodies SET mapped_by = ?1 WHERE body_name = ?2",
        params![commander_name, body_name],
    )
    .ok();
}

pub fn get_bodies_by_system(conn: &Connection, system_address: i64) -> Vec<SystemBody> {
    let mut stmt = conn
        .prepare(
            "SELECT b.body_id, b.body_name, b.body_type, b.planet_class, b.landable, b.terraform_state, b.distance,
                    b.discovered_by, b.mapped_by, b.footfall_by, b.biological_signals,
                    b.atmosphere, b.atmosphere_type, b.atmosphere_composition,
                    b.surface_temp, b.gravity, b.pressure, b.volcanism,
                    ss.star_class, ss.x, ss.y, ss.z
             FROM bodies b
             LEFT JOIN star_systems ss ON ss.system_address = b.system_address
             WHERE b.system_address = ?1 AND b.body_type NOT IN ('Barycenter', 'Unknown')
             ORDER BY b.body_id ASC",
        )
        .unwrap();

    stmt.query_map(params![system_address], |row| {
        let atm_comp_str: Option<String> = row.get(13)?;
        let atmosphere_composition: Option<serde_json::Value> = atm_comp_str
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());

        Ok(SystemBody {
            body_id: row.get(0)?,
            body_name: row.get(1)?,
            body_type: row.get(2)?,
            planet_class: row.get(3)?,
            landable: row.get(4)?,
            terraform_state: row.get(5)?,
            distance: row.get(6)?,
            discovered_by: row.get(7)?,
            mapped_by: row.get(8)?,
            footfall_by: row.get(9)?,
            biological_signals: row.get(10)?,
            atmosphere: row.get(11)?,
            atmosphere_type: row.get(12)?,
            atmosphere_composition,
            surface_temp: row.get(14)?,
            gravity: row.get(15)?,
            pressure: row.get(16)?,
            volcanism: row.get(17)?,
            star_class: row.get(18)?,
            x: row.get(19)?,
            y: row.get(20)?,
            z: row.get(21)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

pub fn get_systems_visited(conn: &Connection) -> Vec<SystemVisit> {
    let mut stmt = conn
        .prepare(
            "SELECT sv.system_address, ss.system_name, sv.visited_at,
                    COALESCE(ss.ammonia_worlds,        0),
                    COALESCE(ss.earthlike_worlds,      0),
                    COALESCE(ss.water_worlds,          0),
                    COALESCE(ss.terraformable_planets, 0)
             FROM systems_visited sv
             LEFT JOIN star_systems ss ON ss.system_address = sv.system_address
             ORDER BY sv.id DESC",
        )
        .unwrap();

    stmt.query_map([], |row| {
        Ok(SystemVisit {
            system_address: row.get(0)?,
            system_name: row.get(1)?,
            visited_at: row.get(2)?,
            ammonia_worlds: row.get(3)?,
            earthlike_worlds: row.get(4)?,
            water_worlds: row.get(5)?,
            terraformable_planets: row.get(6)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

pub fn get_bio_scans_by_system(conn: &Connection, system_address: i64) -> Vec<BioScan> {
    let mut stmt = conn
        .prepare(
            "SELECT id, system_address, body_id, body_name, genus, species, variant,
                    status, first_found, base_value, commander_fid, updated_at
             FROM bio_scans
             WHERE system_address = ?1
             ORDER BY body_id ASC, id ASC",
        )
        .unwrap();

    stmt.query_map(params![system_address], |row| {
        Ok(BioScan {
            id: row.get(0)?,
            system_address: row.get(1)?,
            body_id: row.get(2)?,
            body_name: row.get(3)?,
            genus: row.get(4)?,
            species: row.get(5)?,
            variant: row.get(6)?,
            status: row.get(7)?,
            first_found: row.get(8)?,
            base_value: row.get(9)?,
            commander_fid: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

pub fn get_all_bio_scans(conn: &Connection) -> Vec<BioScan> {
    let mut stmt = conn
        .prepare(
            "SELECT id, system_address, body_id, body_name, genus, species, variant,
                    status, first_found, base_value, commander_fid, updated_at
             FROM bio_scans
             ORDER BY system_address ASC, body_id ASC, id ASC",
        )
        .unwrap();

    stmt.query_map([], |row| {
        Ok(BioScan {
            id: row.get(0)?,
            system_address: row.get(1)?,
            body_id: row.get(2)?,
            body_name: row.get(3)?,
            genus: row.get(4)?,
            species: row.get(5)?,
            variant: row.get(6)?,
            status: row.get(7)?,
            first_found: row.get(8)?,
            base_value: row.get(9)?,
            commander_fid: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

pub fn set_bio_scan_value(conn: &Connection, id: i64, base_value: i64) {
    conn.execute(
        "UPDATE bio_scans SET base_value = ?1 WHERE id = ?2",
        params![base_value, id],
    )
    .ok();
}

pub fn get_system_stats(conn: &Connection, system_address: i64) -> Option<SystemStats> {
    conn.query_row(
        "SELECT ss.body_count, ss.all_bodies_found, COUNT(b.id) AS found_count
         FROM star_systems ss
         LEFT JOIN bodies b ON b.system_address = ss.system_address
           AND b.body_type NOT IN ('Barycenter', 'Unknown')
         WHERE ss.system_address = ?1
         GROUP BY ss.system_address",
        params![system_address],
        |row| {
            Ok(SystemStats {
                body_count: row.get(0)?,
                all_bodies_found: row.get(1)?,
                found_count: row.get(2)?,
            })
        },
    )
    .ok()
}
