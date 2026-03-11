export interface GameEvent {
  _id: string;
  type: string;
  raw: string;
  data: Record<string, unknown>;
  commander: string | null;
}

export interface WatchingInfo {
  folder: string;
  file: string | null;
  filename: string | null;
  scanning: boolean;
}

export interface Commander {
  fid: string;
  name: string;
  currentSystem: number | null;
  currentSystemName: string | null;
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
  biological_signals: number | null;
  atmosphere: string | null;
  atmosphere_type: string | null;
  atmosphere_composition: { Name: string; Percent: number }[] | null;
  surface_temp: number | null;
  gravity: number | null;
  pressure: number | null;
  volcanism: string | null;
  star_class: string | null;
  x: number | null;
  y: number | null;
  z: number | null;
}

export interface SystemVisit {
  system_address: number;
  system_name: string | null;
  visited_at: string;
  ammonia_worlds: number;
  earthlike_worlds: number;
  water_worlds: number;
  terraformable_planets: number;
}

export interface SystemStats {
  body_count: number | null;
  all_bodies_found: number;
  found_count: number;
}
