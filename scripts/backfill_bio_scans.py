#!/usr/bin/env python3
"""
Backfill the bio_scans table from raw events in the events table.

Mirrors the logic in src-tauri/src/database.rs:
  - process_saa_signals_found    (SAASignalsFound events)
  - process_scan_organic         (ScanOrganic events)
  - process_disembark_footfall   (Disembark OnPlanet events → footfall_by + first_found)
  - SPECIES_VALUES lookup        (base_value for complete scans)

DB path (Linux): ~/.local/share/com.odysseychronicle.app/chronicle.db
"""

import sqlite3
import json
import sys
import os

# Mirrors bio_data.ts SPECIES[].value — species localised name → base credit value
SPECIES_VALUES: dict[str, int] = {
    'Aleoida Arcus': 7252500,
    'Aleoida Coronamus': 6284600,
    'Aleoida Spica': 3385200,
    'Aleoida Laminiae': 3385200,
    'Aleoida Gravis': 12934900,
    'Luteolum Anemone': 1499900,
    'Croceum Anemone': 1499900,
    'Puniceum Anemone': 1499900,
    'Roseum Anemone': 1499900,
    'Rubeum Bioluminescent Anemone': 1499900,
    'Prasinum Bioluminescent Anemone': 1499900,
    'Roseum Bioluminescent Anemone': 1499900,
    'Blatteum Bioluminescent Anemone': 1499900,
    'Aureum Brain Tree': 1593700,
    'Gypseeum Brain Tree': 1593700,
    'Lividum Brain Tree': 1593700,
    'Viride Brain Tree': 1593700,
    'Lindigoticum Brain Tree': 1593700,
    'Puniceum Brain Tree': 1593700,
    'Roseum Brain Tree': 1593700,
    'Ostrinum Brain Tree': 1593700,
    'Bacterium Acies': 1000000,
    'Bacterium Alcyoneum': 1658500,
    'Bacterium Aurasus': 1000000,
    'Bacterium Bullaris': 1152500,
    'Bacterium Cerbrus': 1689800,
    'Bacterium Informem': 8418000,
    'Bacterium Nebulus': 5289900,
    'Bacterium Omentum': 4638900,
    'Bacterium Scopulum': 4934500,
    'Bacterium Tela': 1949000,
    'Bacterium Verrata': 3897000,
    'Bacterium Vesicula': 1000000,
    'Bacterium Volu': 7774700,
    'Bark Mound': 1471900,
    'Amphora Plant': 1628800,
    'Crystalline Shards': 1628800,
    'Cactoida Cortexum': 3667600,
    'Cactoida Lapis': 2483600,
    'Cactoida Peperatis': 2483600,
    'Cactoida Pullulanta': 3667600,
    'Cactoida Vermis': 16202800,
    'Clypeus Lacrimam': 8418000,
    'Clypeus Margaritus': 11873200,
    'Clypeus Speculumi': 16202800,
    'Concha Aureolas': 7774700,
    'Concha Biconcavis': 16777215,
    'Concha Labiata': 2352400,
    'Concha Renibus': 4572400,
    'Electricae Pluma': 6284600,
    'Electricae Radialem': 6284600,
    'Fonticulua Campestris': 1000000,
    'Fonticulua Digitos': 1804100,
    'Fonticulua Fluctus': 20000000,
    'Fonticulua Lapida': 3111000,
    'Fonticulua Segmentatus': 19010800,
    'Fonticulua Upupam': 5727600,
    'Frutexa Acus': 7774700,
    'Frutexa Collum': 1639800,
    'Frutexa Fera': 1632500,
    'Frutexa Flabellum': 1808900,
    'Frutexa Flammasis': 10326000,
    'Frutexa Metallicum': 1632500,
    'Frutexa Sponsae': 5988000,
    'Fumerola Aquatis': 6284600,
    'Fumerola Carbosis': 6284600,
    'Fumerola Extremus': 16202800,
    'Fumerola Nitris': 7500900,
    'Fungoida Bullarum': 3703200,
    'Fungoida Gelata': 3330300,
    'Fungoida Setisis': 1670100,
    'Fungoida Stabitis': 2680300,
    'Osseus Cornibus': 1483000,
    'Osseus Discus': 12934900,
    'Osseus Fractus': 4027800,
    'Osseus Pellebantus': 9739000,
    'Osseus Pumice': 3156300,
    'Osseus Spiralis': 2404700,
    'Recepta Conditivus': 14313700,
    'Recepta Deltahedronix': 16202800,
    'Recepta Umbrux': 12934900,
    'Albidum Sinuous Tubers': 1514500,
    'Blatteum Sinuous Tubers': 1514500,
    'Caeruleum Sinuous Tubers': 1514500,
    'Lindigoticum Sinuous Tubers': 1514500,
    'Prasinum Sinuous Tubers': 1514500,
    'Roseum Sinuous Tubers': 1514500,
    'Violaceum Sinuous Tubers': 1514500,
    'Viride Sinuous Tubers': 1514500,
    'Stratum Araneamus': 2448900,
    'Stratum Cucumisis': 16202800,
    'Stratum Excutitus': 2448900,
    'Stratum Frigus': 2637500,
    'Stratum Laminamus': 2788300,
    'Stratum Limaxus': 1362000,
    'Stratum Paleas': 1362000,
    'Stratum Tectonicas': 19010800,
    'Tubus Cavas': 11873200,
    'Tubus Compagibus': 7774700,
    'Tubus Conifer': 2415500,
    'Tubus Rosarium': 2637500,
    'Tubus Sororibus': 5727600,
    'Tussock Albata': 3252500,
    'Tussock Capillum': 7025800,
    'Tussock Caputus': 3472400,
    'Tussock Catena': 1766600,
    'Tussock Cultro': 1766600,
    'Tussock Divisa': 1766600,
    'Tussock Ignis': 1849000,
    'Tussock Pennata': 5853800,
    'Tussock Pennatis': 1000000,
    'Tussock Propagito': 1000000,
    'Tussock Serrati': 4447100,
    'Tussock Stigmasis': 19010800,
    'Tussock Triticum': 7774700,
    'Tussock Ventusa': 3227700,
    'Tussock Virgam': 14313700,
}

DEFAULT_DB = os.path.expanduser(
    "~/.local/share/com.odysseychronicle.app/chronicle.db"
)


def lookup_body_name(conn: sqlite3.Connection, system_address: int, body_id: int) -> str | None:
    row = conn.execute(
        "SELECT body_name FROM bodies WHERE system_address = ? AND body_id = ? LIMIT 1",
        (system_address, body_id),
    ).fetchone()
    return row[0] if row else None


def process_saa_signals_found(conn: sqlite3.Connection, d: dict, commander_fid: str | None):
    system_address = d.get("SystemAddress")
    body_id = d.get("BodyID")
    updated_at = d.get("timestamp", "")
    genuses = d.get("Genuses")

    if system_address is None or body_id is None or not genuses:
        return

    body_name = lookup_body_name(conn, system_address, body_id)

    for genus_entry in genuses:
        genus = genus_entry.get("Genus_Localised", "")
        if not genus:
            continue

        count = conn.execute(
            "SELECT COUNT(*) FROM bio_scans WHERE system_address = ? AND body_id = ? AND genus = ?",
            (system_address, body_id, genus),
        ).fetchone()[0]

        if count == 0:
            conn.execute(
                """INSERT INTO bio_scans
                   (system_address, body_id, body_name, genus, status, commander_fid, updated_at)
                   VALUES (?, ?, ?, ?, 'genus', ?, ?)""",
                (system_address, body_id, body_name, genus, commander_fid, updated_at),
            )


def process_disembark_footfall(conn: sqlite3.Connection, d: dict, commander_name: str):
    if not d.get("OnPlanet"):
        return
    body_name = d.get("Body")
    if not body_name:
        return

    row = conn.execute(
        "SELECT system_address, body_id, footfall_by FROM bodies WHERE body_name = ? LIMIT 1",
        (body_name,),
    ).fetchone()
    if not row or row[2] is not None:  # body not found or footfall already claimed
        return

    system_address, body_id, _ = row
    conn.execute(
        "UPDATE bodies SET footfall_by = ? WHERE body_name = ? AND footfall_by IS NULL",
        (commander_name, body_name),
    )
    conn.execute(
        "UPDATE bio_scans SET first_found = 1 WHERE system_address = ? AND body_id = ?",
        (system_address, body_id),
    )


def process_scan_organic(conn: sqlite3.Connection, d: dict, commander_fid: str | None):
    """
    Faithful translation of the two-step Rust upsert logic using explicit rowcount checks.
    """
    system_address = d.get("SystemAddress")
    body_id = d.get("Body")
    genus = d.get("Genus_Localised")
    species = d.get("Species_Localised")
    variant = d.get("Variant_Localised")
    scan_type = d.get("ScanType", "Log")
    updated_at = d.get("timestamp", "")

    if system_address is None or body_id is None or not genus or not species:
        return

    status = "complete" if scan_type == "Analyse" else "collecting"

    # Step 1: try to upgrade an existing genus-only row
    cur = conn.execute(
        """UPDATE bio_scans
           SET species       = ?,
               variant       = COALESCE(?, variant),
               status        = ?,
               commander_fid = COALESCE(commander_fid, ?),
               updated_at    = ?
           WHERE id = (
               SELECT id FROM bio_scans
               WHERE system_address = ? AND body_id = ? AND genus = ? AND species IS NULL
               ORDER BY id LIMIT 1
           )""",
        (species, variant, status, commander_fid, updated_at,
         system_address, body_id, genus),
    )

    if cur.rowcount == 0:
        # Step 2: no genus-only row — upsert by species (unique index on system_address, body_id, species)
        body_name = lookup_body_name(conn, system_address, body_id)
        conn.execute(
            """INSERT INTO bio_scans
               (system_address, body_id, body_name, genus, species, variant, status, commander_fid, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(system_address, body_id, species) WHERE species IS NOT NULL DO UPDATE SET
                   status        = CASE WHEN excluded.status = 'complete' THEN 'complete' ELSE bio_scans.status END,
                   variant       = COALESCE(excluded.variant, bio_scans.variant),
                   updated_at    = excluded.updated_at""",
            (system_address, body_id, body_name, genus, species, variant,
             status, commander_fid, updated_at),
        )

    # Belt-and-suspenders: Analyse scans always force status to 'complete'
    if status == "complete":
        conn.execute(
            "UPDATE bio_scans SET status = 'complete', updated_at = ? "
            "WHERE system_address = ? AND body_id = ? AND species = ?",
            (updated_at, system_address, body_id, species),
        )


def backfill(db_path: str):
    if not os.path.exists(db_path):
        print(f"ERROR: database not found at {db_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Opening database: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.isolation_level = None  # autocommit off; we manage transactions

    try:
        conn.execute("BEGIN")

        # Clear existing bio_scans
        deleted = conn.execute("DELETE FROM bio_scans").rowcount
        print(f"Cleared {deleted} existing bio_scan rows")

        # --- SAASignalsFound ---
        rows = conn.execute(
            "SELECT data, commander FROM events WHERE type = 'SAASignalsFound' ORDER BY id ASC"
        ).fetchall()
        print(f"Replaying {len(rows)} SAASignalsFound events...")
        for data_str, commander_fid in rows:
            try:
                d = json.loads(data_str)
                process_saa_signals_found(conn, d, commander_fid)
            except Exception as e:
                print(f"  WARN SAASignalsFound: {e}")

        # --- ScanOrganic ---
        rows = conn.execute(
            "SELECT data, commander FROM events WHERE type = 'ScanOrganic' ORDER BY id ASC"
        ).fetchall()
        print(f"Replaying {len(rows)} ScanOrganic events...")
        for data_str, commander_fid in rows:
            try:
                d = json.loads(data_str)
                process_scan_organic(conn, d, commander_fid)
            except Exception as e:
                print(f"  WARN ScanOrganic: {e}")

        # --- Disembark (first footfall) ---
        conn.execute("UPDATE bodies SET footfall_by = NULL")
        rows = conn.execute(
            """SELECT e.data, c.name FROM events e
               JOIN commanders c ON c.fid = e.commander
               WHERE e.type = 'Disembark'
                 AND json_extract(e.data, '$.OnPlanet') = 1
               ORDER BY e.id ASC"""
        ).fetchall()
        print(f"Replaying {len(rows)} Disembark (OnPlanet) events...")
        for data_str, commander_name in rows:
            try:
                d = json.loads(data_str)
                process_disembark_footfall(conn, d, commander_name)
            except Exception as e:
                print(f"  WARN Disembark: {e}")

        # --- Scan values ---
        rows = conn.execute(
            "SELECT id, species FROM bio_scans WHERE status = 'complete' AND species IS NOT NULL AND base_value IS NULL"
        ).fetchall()
        updated = 0
        for scan_id, species in rows:
            value = SPECIES_VALUES.get(species)
            if value is not None:
                conn.execute("UPDATE bio_scans SET base_value = ? WHERE id = ?", (value, scan_id))
                updated += 1
        print(f"Set base_value on {updated}/{len(rows)} complete scans")

        count = conn.execute("SELECT COUNT(*) FROM bio_scans").fetchone()[0]
        print(f"Done — {count} bio_scan rows after backfill")

        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DB
    backfill(db_path)
