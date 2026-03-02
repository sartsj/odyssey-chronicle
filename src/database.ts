import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import type { GameEvent } from './index';

let db: Database.Database;

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'chronicle.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Migration: add commander column to events if upgrading from an older DB
  try { db.exec('ALTER TABLE events ADD COLUMN commander TEXT'); } catch { /* already exists */ }
  // Migration: add parent relationship columns to bodies
  try { db.exec('ALTER TABLE bodies ADD COLUMN parent_body_id   INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE bodies ADD COLUMN parent_body_type TEXT');    } catch { /* already exists */ }
  try { db.exec('ALTER TABLE bodies ADD COLUMN terraform_state  TEXT');    } catch { /* already exists */ }
  // Migration: add scan value columns
  try { db.exec('ALTER TABLE bodies ADD COLUMN scan_value INTEGER');                                    } catch { /* already exists */ }
  try { db.exec('ALTER TABLE star_systems ADD COLUMN estimated_scan_value INTEGER NOT NULL DEFAULT 0'); } catch { /* already exists */ }

  // Migration: add star_type column
  try { db.exec('ALTER TABLE bodies ADD COLUMN star_type TEXT'); } catch { /* already exists */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT    NOT NULL,
      timestamp   TEXT    NOT NULL,
      data        TEXT    NOT NULL,
      commander   TEXT
    );

    CREATE TABLE IF NOT EXISTS star_systems (
      system_address        INTEGER PRIMARY KEY,
      system_name           TEXT    NOT NULL,
      star_class            TEXT    NOT NULL,
      body_count            INTEGER,
      non_body_count        INTEGER,
      all_bodies_found      INTEGER NOT NULL,
      estimated_scan_value  INTEGER NOT NULL DEFAULT 0,
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

      planet_class    TEXT,
      atmosphere      TEXT,
      atmosphere_type TEXT,
      volcanism       TEXT,
      gravity         REAL,
      pressure        REAL,
      landable        INTEGER,
      terraform_state   TEXT,

      parent_body_id    INTEGER,
      parent_body_type  TEXT,

      discovered_by   TEXT,
      mapped_by       TEXT,
      footfall_by     TEXT,
      scan_value      INTEGER,
      UNIQUE(body_name)
    );

    CREATE TABLE IF NOT EXISTS systems_visited (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      system_address INTEGER NOT NULL,
      visited_at     TEXT    NOT NULL,
      UNIQUE(visited_at)
    );
  `);

  // Backfill systems_visited from any FSDJump events already in the events table.
  db.exec(`
    INSERT OR IGNORE INTO systems_visited (system_address, visited_at)
    SELECT json_extract(data, '$.SystemAddress'), json_extract(data, '$.timestamp')
    FROM events
    WHERE type = 'FSDJump'
      AND json_extract(data, '$.SystemAddress') IS NOT NULL
      AND json_extract(data, '$.timestamp')     IS NOT NULL
    ORDER BY id ASC
  `);

  // After migrations, replay scan events for the current system so any newly-added
  // columns (e.g. parent_body_id / parent_body_type) are back-filled from stored events.
  const lastCommander = db.prepare(
    'SELECT current_system FROM commanders ORDER BY rowid DESC LIMIT 1'
  ).get() as { current_system: number | null } | undefined;
  if (lastCommander?.current_system) {
    replayScanEventsForSystem(lastCommander.current_system);
  }
}

function processFSSDiscoveryScan(d: Record<string, unknown>): void {
  const { SystemAddress, BodyCount, NonBodyCount } = d;
  if (
    typeof SystemAddress === 'number' &&
    typeof BodyCount     === 'number' &&
    typeof NonBodyCount  === 'number'
  ) {
    db.prepare(
      `UPDATE star_systems
       SET body_count = ?, non_body_count = ?
       WHERE system_address = ?`
    ).run(BodyCount, NonBodyCount, SystemAddress);
  }
}

function getBaseStarScanValue(star_type: string): number {

  let kValue: number;
  let firstDiscovery: number = 2.6;

  switch (star_type) {

    case 'D':
    case 'DA':
    case 'DAB':
    case 'DAO':
    case 'DAZ':
    case 'DAV':
    case 'DB':
    case 'DBZ':
    case 'DO':
    case 'DOV':
    case 'DQ':
    case 'DC':
    case 'DCV':
    case 'DX':
      return 14057;

    case 'N':
    case 'H':
      return 22628;

    default:
      return 1200;

  }
}

function getBasePlanetScanValue(body_class: string, terraformable: boolean): number {

  const q: number = 0.56591828;
  let kValue: number;

  switch (body_class.toLowerCase()) {
    case 'ammonia world':
      return 96932;

    case 'earthlike body':
      // always 'terraformable', so we always return the same value
      return 64831 + 116295;

    case 'water world':
      kValue = 64831;

      if (terraformable) {
        kValue += 116295
      }
 
      return kValue;

    case 'metal rich body':
      kValue = 21790;

      if (terraformable) {
        kValue += 65631
      }

      return kValue;
    
    case 'sudarsky class ii gas giant':
    case 'high metal content body':
      kValue = 9654;

      if (terraformable) {
        kValue += 100677
      }

      return kValue;

    case 'sudarsky class i gas giant':
      return 1656;

    default:
      kValue = 300;

      if (terraformable) {
        kValue += 93328
      }

      return kValue;
  }

}

function estimateBodyScanValue(k: number, mass: number, isFirstDiscoverer: boolean, isMapped: boolean, isFirstMapped: boolean, withEfficiencyBonus: boolean) {
  const q = 0.56591828;
  let mappingMultiplier = 1;

  if(isMapped)
  {
      if(isFirstDiscoverer && isFirstMapped)
      {
          mappingMultiplier = 3.699622554;
      }
      else if(isFirstMapped)
      {
          mappingMultiplier = 8.0956;
      }
      else
      {
          mappingMultiplier = 3.3333333333;
      }
  }
  let value = (k + k * q * Math.pow(mass,0.2)) * mappingMultiplier;
  if(isMapped)
  {
      value += ((value * 0.3) > 555) ? value * 0.3 : 555;

      if(withEfficiencyBonus)
      {
          value *= 1.25;
      }
  }

  value = Math.max(500, value);
  value *= (isFirstDiscoverer) ? 2.6 : 1;

  return Math.round(value);
}

function processBodyScan(d: Record<string, unknown>): void {
  const systemAddress = typeof d.SystemAddress === 'number' ? d.SystemAddress : null;
  const bodyId        = typeof d.BodyID         === 'number' ? d.BodyID         : null;
  const bodyName      = typeof d.BodyName       === 'string' ? d.BodyName       : null;
  const distance      = typeof d.DistanceFromArrivalLS === 'number' ? d.DistanceFromArrivalLS : null;

  const wasDiscovered = d.wasDiscovered === true;
  const wasMapped     = d.wasMapped     === true;

  if (systemAddress === null || bodyId === null || bodyName === null || distance === null) return;

  const isStar    = typeof d.StarType === 'string';

  // Parse immediate parent from the Parents array
  let parentBodyId:   number | null = null;
  let parentBodyType: string | null = null;
  if (Array.isArray(d.Parents) && d.Parents.length > 0) {
    const first = d.Parents[0] as Record<string, number>;
    const key   = Object.keys(first)[0];
    if (key !== undefined) {
      parentBodyId   = first[key] ?? null;
      parentBodyType = key; // "Star" | "Planet" | "Null"
    }
  }
  
  let bodyType: string;
  let k: number;
  let scanValue: number;
  if (isStar) {
    bodyType = 'Star';
    k = getBaseStarScanValue(typeof d.StarType === 'string' ? d.StarType : null)
    scanValue = estimateBodyScanValue(k, typeof d.StellarMass === 'number' ? d.StellarMass : null, !wasDiscovered, false, !wasMapped, true);
  } else if (typeof d.PlanetClass === 'string') {
    bodyType = 'Planet';
    let terraformable = d.TerraformState === 'Terraformable'
    k = getBasePlanetScanValue(typeof d.PlanetClass === 'string' ? d.PlanetClass : null, terraformable)
    scanValue = estimateBodyScanValue(k, typeof d.MassEM === 'number' ? d.MassEM : null, !wasDiscovered, false, !wasMapped, true);
  } else {
    bodyType = 'Unknown';
  }

  db.prepare(`
    INSERT INTO bodies (
      system_address, body_id, body_name, body_type, distance,
      sub_class, star_type, mass, radius, age, surface_temp, luminosity,
      planet_class, atmosphere, atmosphere_type, volcanism, gravity, pressure, landable,
      terraform_state, parent_body_id, parent_body_type, scan_value
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(body_name) DO UPDATE SET
      body_type        = excluded.body_type,
      distance         = excluded.distance,
      sub_class        = excluded.sub_class,
      star_type        = excluded.star_type,
      mass             = excluded.mass,
      radius           = excluded.radius,
      age              = excluded.age,
      surface_temp     = excluded.surface_temp,
      luminosity       = excluded.luminosity,
      planet_class     = excluded.planet_class,
      atmosphere       = excluded.atmosphere,
      atmosphere_type  = excluded.atmosphere_type,
      volcanism        = excluded.volcanism,
      gravity          = excluded.gravity,
      pressure         = excluded.pressure,
      landable         = excluded.landable,
      terraform_state  = excluded.terraform_state,
      parent_body_id   = excluded.parent_body_id,
      parent_body_type = excluded.parent_body_type,
      scan_value       = excluded.scan_value
  `).run(
    systemAddress,
    bodyId,
    bodyName,
    bodyType,
    distance,
    typeof d.Subclass           === 'number'  ? d.Subclass          : null,
    typeof d.StarType           === 'string'  ? d.StarType          : null,
    isStar
      ? (typeof d.StellarMass   === 'number'  ? d.StellarMass       : null)
      : (typeof d.MassEM        === 'number'  ? d.MassEM            : null),
    typeof d.Radius             === 'number'  ? d.Radius            : null,
    typeof d.Age_MY             === 'number'  ? d.Age_MY            : null,
    typeof d.SurfaceTemperature === 'number'  ? d.SurfaceTemperature : null,
    typeof d.Luminosity         === 'string'  ? d.Luminosity        : null,
    typeof d.PlanetClass        === 'string'  ? d.PlanetClass       : null,
    typeof d.Atmosphere         === 'string'  ? d.Atmosphere        : null,
    typeof d.AtmosphereType     === 'string'  ? d.AtmosphereType    : null,
    typeof d.Volcanism          === 'string'  ? d.Volcanism         : null,
    typeof d.SurfaceGravity     === 'number'  ? d.SurfaceGravity    : null,
    typeof d.SurfacePressure    === 'number'  ? d.SurfacePressure   : null,
    typeof d.Landable           === 'boolean' ? (d.Landable ? 1 : 0) : null,
    typeof d.TerraformState     === 'string'  ? d.TerraformState   : null,
    parentBodyId,
    parentBodyType,
    scanValue,
  );

  db.prepare(`
    UPDATE star_systems
    SET estimated_scan_value = (
      SELECT COALESCE(SUM(scan_value), 0)
      FROM bodies
      WHERE system_address = ? AND body_type NOT IN ('Barycenter', 'Unknown')
    )
    WHERE system_address = ?
  `).run(systemAddress, systemAddress);

  // Insert barycenter when first seen as a Null parent — barycenters are never
  // directly scanned so this is the only opportunity to record them.
  if (parentBodyType === 'Null' && parentBodyId !== null) {
    db.prepare(
      `INSERT OR IGNORE INTO bodies
         (system_address, body_id, body_name, body_type, distance)
       VALUES (?, ?, ?, 'Barycenter', 0)`
    ).run(systemAddress, parentBodyId, `$bc:${systemAddress}:${parentBodyId}`);
  }
}

function replayScanEventsForSystem(systemAddress: number): void {
  const fssRows = db.prepare(
    `SELECT data FROM events WHERE type = 'FSSDiscoveryScan'
     AND json_extract(data, '$.SystemAddress') = ? ORDER BY id ASC`
  ).all(systemAddress) as Array<{ data: string }>;
  for (const { data } of fssRows) {
    processFSSDiscoveryScan(JSON.parse(data) as Record<string, unknown>);
  }

  const scanRows = db.prepare(
    `SELECT data FROM events WHERE type = 'Scan'
     AND json_extract(data, '$.SystemAddress') = ? ORDER BY id ASC`
  ).all(systemAddress) as Array<{ data: string }>;
  for (const { data } of scanRows) {
    processBodyScan(JSON.parse(data) as Record<string, unknown>);
  }
}

export function insertEvent(event: GameEvent, commanderFid: string | null = null): void {
  const timestamp =
    typeof event.data.timestamp === 'string'
      ? event.data.timestamp
      : new Date().toISOString();

  db.prepare(
    'INSERT INTO events (type, timestamp, data, commander) VALUES (?, ?, ?, ?)'
  ).run(event.type, timestamp, event.raw, commanderFid);

  // Populate star_systems from FSDTarget events
  if (event.type === 'FSDTarget') {
    const { SystemAddress, Name, StarClass } = event.data;
    if (
      typeof SystemAddress === 'number' &&
      typeof Name    === 'string' &&
      typeof StarClass     === 'string'
    ) {
      db.prepare(
        `INSERT OR IGNORE INTO star_systems
           (system_address, system_name, star_class, all_bodies_found)
         VALUES (?, ?, ?, 0)`
      ).run(SystemAddress, Name, StarClass);
    }
  }

  // Populate star_systems from StartJump events
  if (event.type === 'StartJump') {
    const { SystemAddress, StarSystem, StarClass } = event.data;
    if (
      typeof SystemAddress === 'number' &&
      typeof StarSystem    === 'string' &&
      typeof StarClass     === 'string'
    ) {
      db.prepare(
        `INSERT OR IGNORE INTO star_systems
           (system_address, system_name, star_class, all_bodies_found)
         VALUES (?, ?, ?, 0)`
      ).run(SystemAddress, StarSystem, StarClass);
    }
  }

  // Populate star_systems and log visit from FSDJump events
  if (event.type === 'FSDJump') {
    const { SystemAddress, StarSystem, StarClass } = event.data;
    if (
      typeof SystemAddress === 'number' &&
      typeof StarSystem    === 'string' &&
      typeof StarClass     === 'string'
    ) {
      db.prepare(
        `INSERT INTO star_systems
           (system_address, system_name, star_class, all_bodies_found)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(system_address) DO UPDATE SET star_class = excluded.star_class`
      ).run(SystemAddress, StarSystem, StarClass);
      db.prepare(
        'INSERT OR IGNORE INTO systems_visited (system_address, visited_at) VALUES (?, ?)'
      ).run(SystemAddress, timestamp);
    }
  }

  // Update body/non-body counts from FSSDiscoveryScan events
  if (event.type === 'FSSDiscoveryScan') {
    processFSSDiscoveryScan(event.data);
  }

  // Upsert bodies from Scan events
  if (event.type === 'Scan') {
    processBodyScan(event.data);
  }
}

export function getAllEvents(): GameEvent[] {
  const rows = db
    .prepare('SELECT id, type, data, commander FROM events ORDER BY id ASC')
    .all() as Array<{ id: number; type: string; data: string; commander: string | null }>;

  return rows.map((row) => ({
    _id: `db-${row.id}`,
    type: row.type,
    raw: row.data,
    data: JSON.parse(row.data) as Record<string, unknown>,
    commander: row.commander,
  }));
}

export function clearEvents(): void {
  db.exec('DELETE FROM events');
}

export function upsertCommander(fid: string, name: string): void {
  db.prepare(
    `INSERT INTO commanders (fid, name) VALUES (?, ?)
     ON CONFLICT(fid) DO UPDATE SET name = excluded.name`
  ).run(fid, name);
}

export function getLastCommander(): { fid: string; name: string; current_system: number | null; system_name: string | null } | null {
  return (
    db.prepare(`
      SELECT c.fid, c.name, c.current_system, s.system_name
      FROM commanders c
      LEFT JOIN star_systems s ON s.system_address = c.current_system
      ORDER BY c.rowid DESC LIMIT 1
    `).get() as
      | { fid: string; name: string; current_system: number | null; system_name: string | null }
      | undefined
  ) ?? null;
}

// Inserts a system from a Location event (no StarClass available — uses INSERT OR IGNORE
// so existing rows with a proper star_class are never overwritten).
export function upsertSystemFromLocation(systemAddress: number, systemName: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO star_systems
       (system_address, system_name, star_class, all_bodies_found)
     VALUES (?, ?, '', 0)`
  ).run(systemAddress, systemName);
}

export function updateCommanderSystem(fid: string, systemAddress: number): void {
  db.prepare('UPDATE commanders SET current_system = ? WHERE fid = ?').run(systemAddress, fid);
}

export function markAllBodiesFound(systemAddress: number): void {
  db.prepare('UPDATE star_systems SET all_bodies_found = 1 WHERE system_address = ?').run(systemAddress);
}

export function updateBodyDiscoveredBy(bodyName: string, commanderName: string): void {
  db.prepare('UPDATE bodies SET discovered_by = ? WHERE body_name = ?').run(commanderName, bodyName);
}

export function updateBodyMappedBy(bodyName: string, commanderName: string): void {
  db.prepare('UPDATE bodies SET mapped_by = ? WHERE body_name = ?').run(commanderName, bodyName);
}

export interface SystemBody {
  body_name: string;
  body_type: string;
  planet_class: string | null;
  landable: number | null;
  terraform_state: string | null;
  distance: number;
  discovered_by: string | null;
  mapped_by: string | null;
  footfall_by: string | null;
}

export function getBodiesBySystem(systemAddress: number): SystemBody[] {
  return db.prepare(
    `SELECT body_name, body_type, planet_class, landable, terraform_state, distance, discovered_by, mapped_by, footfall_by
     FROM bodies WHERE system_address = ? AND body_type NOT IN ('Barycenter', 'Unknown')
     ORDER BY body_id ASC`
  ).all(systemAddress) as SystemBody[];
}

export interface SystemVisit {
  system_address: number;
  system_name: string | null;
  visited_at: string;
}

export function getSystemsVisited(): SystemVisit[] {
  return db.prepare(`
    SELECT sv.system_address, ss.system_name, sv.visited_at
    FROM systems_visited sv
    LEFT JOIN star_systems ss ON ss.system_address = sv.system_address
    ORDER BY sv.id DESC
  `).all() as SystemVisit[];
}
