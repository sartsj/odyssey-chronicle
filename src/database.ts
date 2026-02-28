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

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT    NOT NULL,
      timestamp   TEXT    NOT NULL,
      data        TEXT    NOT NULL,
      commander   TEXT
    );

    CREATE TABLE IF NOT EXISTS star_systems (
      system_address    INTEGER PRIMARY KEY,
      system_name       TEXT NOT NULL,
      star_class        TEXT NOT NULL,
      body_count        INTEGER,
      non_body_count    INTEGER,
      all_bodies_found  INTEGER NOT NULL,
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

      discovered_by   TEXT,
      mapped_by       TEXT,
      footfall_by     TEXT,
      UNIQUE(body_name)
    );
  `);
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

  // Update body/non-body counts from FSSDiscoveryScan events
  if (event.type === 'FSSDiscoveryScan') {
    const { SystemAddress, BodyCount, NonBodyCount } = event.data;
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

  // Upsert bodies from Scan events
  if (event.type === 'Scan') {
    const d = event.data;
    const systemAddress = typeof d.SystemAddress === 'number' ? d.SystemAddress : null;
    const bodyId        = typeof d.BodyID         === 'number' ? d.BodyID         : null;
    const bodyName      = typeof d.BodyName       === 'string' ? d.BodyName       : null;
    const distance      = typeof d.DistanceFromArrivalLS === 'number' ? d.DistanceFromArrivalLS : null;

    if (systemAddress !== null && bodyId !== null && bodyName !== null && distance !== null) {
      const isStar = typeof d.StarType === 'string';
      const bodyType = isStar
        ? 'Star'
        : typeof d.PlanetClass === 'string' ? 'Planet' : 'Unknown';

      db.prepare(`
        INSERT INTO bodies (
          system_address, body_id, body_name, body_type, distance,
          sub_class, mass, radius, age, surface_temp, luminosity,
          planet_class, atmosphere, atmosphere_type, volcanism, gravity, pressure, landable
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(body_name) DO UPDATE SET
          body_type       = excluded.body_type,
          distance        = excluded.distance,
          sub_class       = excluded.sub_class,
          mass            = excluded.mass,
          radius          = excluded.radius,
          age             = excluded.age,
          surface_temp    = excluded.surface_temp,
          luminosity      = excluded.luminosity,
          planet_class    = excluded.planet_class,
          atmosphere      = excluded.atmosphere,
          atmosphere_type = excluded.atmosphere_type,
          volcanism       = excluded.volcanism,
          gravity         = excluded.gravity,
          pressure        = excluded.pressure,
          landable        = excluded.landable
      `).run(
        systemAddress,
        bodyId,
        bodyName,
        bodyType,
        distance,
        typeof d.Subclass           === 'number'  ? d.Subclass          : null,
        isStar
          ? (typeof d.StellarMass   === 'number'  ? d.StellarMass       : null)
          : (typeof d.MassEM        === 'number'  ? d.MassEM            : null),
        typeof d.Radius             === 'number'  ? d.Radius            : null,
        typeof d.Age_MY             === 'number'  ? d.Age_MY            : null,
        typeof d.SurfaceTemperature === 'number' ? d.SurfaceTemperature : null,
        typeof d.Luminosity         === 'string'  ? d.Luminosity        : null,
        typeof d.PlanetClass        === 'string'  ? d.PlanetClass       : null,
        typeof d.Atmosphere         === 'string'  ? d.Atmosphere        : null,
        typeof d.AtmosphereType     === 'string'  ? d.AtmosphereType    : null,
        typeof d.Volcanism          === 'string'  ? d.Volcanism         : null,
        typeof d.SurfaceGravity     === 'number'  ? d.SurfaceGravity    : null,
        typeof d.SurfacePressure    === 'number'  ? d.SurfacePressure   : null,
        typeof d.Landable           === 'boolean' ? (d.Landable ? 1 : 0) : null,
      );
    }
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
  distance: number;
  discovered_by: string | null;
  mapped_by: string | null;
}

export function getBodiesBySystem(systemAddress: number): SystemBody[] {
  return db.prepare(
    `SELECT body_name, body_type, planet_class, landable, distance, discovered_by, mapped_by
     FROM bodies WHERE system_address = ?
     ORDER BY distance ASC`
  ).all(systemAddress) as SystemBody[];
}
