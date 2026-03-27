use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameEvent {
    pub _id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub raw: String,
    pub data: serde_json::Value,
    pub commander: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchingInfo {
    pub folder: String,
    pub file: Option<String>,
    pub filename: Option<String>,
    pub scanning: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Commander {
    pub fid: String,
    pub name: String,
    #[serde(rename = "currentSystem")]
    pub current_system: Option<i64>,
    #[serde(rename = "currentSystemName")]
    pub current_system_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BioScan {
    pub id: i64,
    pub system_address: i64,
    pub body_id: i64,
    pub body_name: Option<String>,
    pub genus: String,
    pub species: Option<String>,
    pub variant: Option<String>,
    pub status: String,
    pub first_found: bool,
    pub base_value: Option<i64>,
    pub commander_fid: Option<String>,
    pub updated_at: String,
    pub sample_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemBody {
    pub body_id: i64,
    pub body_name: String,
    pub body_type: String,
    pub planet_class: Option<String>,
    pub landable: Option<i64>,
    pub terraform_state: Option<String>,
    pub distance: f64,
    pub discovered_by: Option<String>,
    pub mapped_by: Option<String>,
    pub footfall_by: Option<String>,
    pub biological_signals: Option<i64>,
    pub atmosphere: Option<String>,
    pub atmosphere_type: Option<String>,
    pub atmosphere_composition: Option<serde_json::Value>,
    pub surface_temp: Option<f64>,
    pub gravity: Option<f64>,
    pub pressure: Option<f64>,
    pub volcanism: Option<String>,
    pub star_class: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub z: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemVisit {
    pub system_address: i64,
    pub system_name: Option<String>,
    pub visited_at: String,
    pub ammonia_worlds: i64,
    pub earthlike_worlds: i64,
    pub water_worlds: i64,
    pub terraformable_planets: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub body_count: Option<i64>,
    pub all_bodies_found: i64,
    pub found_count: i64,
}
