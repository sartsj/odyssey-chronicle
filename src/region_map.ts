/**
 * Galaxy region mapping for Elite Dangerous.
 * Data and algorithm ported from klightspeed/EliteDangerousRegionMap.
 * Region groupings ported from Silarn/EDMC-BioScan.
 */

import regionmapdata from './RegionMapData.json';

const regions = regionmapdata.regions as (string | null)[];
const regionmap = regionmapdata.regionmap as [number, number][][];

const x0 = -49985;
const z0 = -24105;

/**
 * Returns the galactic region ID (1-42) for the given coordinates, or null
 * if the coordinates fall outside the mapped area.
 */
export function findRegion(x: number, _y: number, z: number): number | null {
  const px = Math.floor((x - x0) * 83 / 4096);
  const pz = Math.floor((z - z0) * 83 / 4096);

  if (px < 0 || pz < 0 || pz >= regionmap.length) return null;

  const row = regionmap[pz];
  let rx = 0;
  let pv = 0;

  for (const [rl, rv] of row) {
    if (px < rx + rl) { pv = rv; break; }
    rx += rl;
  }

  return pv === 0 ? null : pv;
}

/** Returns the display name for a region ID, or null. */
export function regionName(id: number): string | null {
  return regions[id] ?? null;
}

// ---------------------------------------------------------------------------
// EDMC-BioScan region groupings: named arm zones → sets of region IDs
// ---------------------------------------------------------------------------

const REGION_MAP: Record<string, number[]> = {
  'orion-cygnus':              [1, 4, 7, 8, 16, 17, 18, 35],
  'orion-cygnus-1':            [4, 7, 8, 16, 17, 18, 35],
  'orion-cygnus-core':         [7, 8, 16, 17, 18, 35],
  'sagittarius-carina':        [1, 4, 9, 18, 19, 20, 21, 22, 23, 40],
  'sagittarius-carina-core':   [9, 18, 19, 20, 21, 22, 23, 40],
  'sagittarius-carina-core-9': [18, 19, 20, 21, 22, 23, 40],
  'scutum-centaurus':          [1, 4, 9, 10, 11, 12, 24, 25, 26, 42, 28],
  'scutum-centaurus-core':     [9, 10, 11, 12, 24, 25, 26, 42, 28],
  'outer':                     [1, 2, 5, 6, 13, 14, 27, 29, 31, 41, 37],
  'perseus':                   [1, 3, 7, 15, 30, 32, 33, 34, 36, 38, 39],
  'perseus-core':              [3, 7, 15, 30, 32, 33, 34, 36, 38, 39],
  'exterior':                  [14, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 34, 36, 37, 38, 39, 40, 41, 42],
  'anemone-a':                 [7, 8, 13, 14, 15, 16, 17, 18, 27, 32],
  'amphora':                   [10, 19, 20, 21, 22],
  'brain-tree':                [2, 9, 10, 17, 18, 35],
  'empyrean-straits':          [2],
  'center':                    [1, 2, 3],
};

/**
 * Returns true if the given region ID is considered to be in the named arm/zone.
 * Supports negation prefix "!" (e.g. "!orion-cygnus" means NOT in that group).
 */
export function systemInRegion(regionId: number, zone: string): boolean {
  if (zone.startsWith('!')) {
    const ids = REGION_MAP[zone.slice(1)];
    return ids ? !ids.includes(regionId) : true;
  }
  const ids = REGION_MAP[zone];
  return ids ? ids.includes(regionId) : false;
}
