#!/usr/bin/env node
// One-time backfill script: populates ammonia_worlds, earth_like_worlds,
// water_worlds, and terraformable_planets for all existing star_systems rows.
//
// Usage:
//   node scripts/backfill-body-counts.js [path/to/chronicle.db]
//
// If no path is given, defaults to ~/.config/odyssey-chronicle/chronicle.db

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = process.argv[2]
  ?? path.join(os.homedir(), '.config', 'odyssey-chronicle', 'chronicle.db');

console.log(`Opening database: ${dbPath}`);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const systems = db.prepare('SELECT system_address FROM star_systems').all();
console.log(`Found ${systems.length} system(s) to update.`);

const update = db.prepare(`
  UPDATE star_systems
  SET
    ammonia_worlds        = (SELECT COUNT(*) FROM bodies WHERE system_address = ? AND LOWER(planet_class) = 'ammonia world'),
    earth_like_worlds     = (SELECT COUNT(*) FROM bodies WHERE system_address = ? AND LOWER(planet_class) = 'earthlike body'),
    water_worlds          = (SELECT COUNT(*) FROM bodies WHERE system_address = ? AND LOWER(planet_class) = 'water world'),
    terraformable_planets = (SELECT COUNT(*) FROM bodies WHERE system_address = ? AND terraform_state = 'Terraformable')
  WHERE system_address = ?
`);

const run = db.transaction(() => {
  let updated = 0;
  for (const { system_address } of systems) {
    update.run(system_address, system_address, system_address, system_address, system_address);
    updated++;
  }
  return updated;
});

const count = run();
console.log(`Done. Updated ${count} system(s).`);

db.close();
