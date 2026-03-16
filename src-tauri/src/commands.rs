use crate::config::{read_config, write_config, Config};
use crate::database;
use crate::state::AppState;
use crate::types::{BioScan, Commander, GameEvent, SystemBody, SystemStats, SystemVisit, WatchingInfo};
use crate::watcher;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn folder_set(
    folder: String,
    app: AppHandle,
    conn: State<'_, Arc<Mutex<Connection>>>,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> WatchingInfo {
    write_config(&app, &Config { folder: Some(folder.clone()) });
    let folder_path = PathBuf::from(&folder);

    if let Some(file) = watcher::find_latest_file(&folder_path) {
        let filename = file
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        watcher::start_watching(
            file.clone(),
            app,
            conn.inner().clone(),
            state.inner().clone(),
        );
        WatchingInfo {
            folder,
            file: Some(file.to_string_lossy().to_string()),
            filename: Some(filename),
            scanning: false,
        }
    } else {
        watcher::begin_polling(
            folder_path,
            app,
            conn.inner().clone(),
            state.inner().clone(),
        );
        WatchingInfo {
            folder,
            file: None,
            filename: None,
            scanning: true,
        }
    }
}

#[tauri::command]
pub fn folder_get(app: AppHandle) -> Option<String> {
    read_config(&app).folder
}

#[tauri::command]
pub fn file_stop(
    state: State<'_, Arc<Mutex<AppState>>>,
) {
    watcher::stop_polling(state.inner());
    watcher::stop_watching(state.inner());
}

#[tauri::command]
pub fn commander_get(state: State<'_, Arc<Mutex<AppState>>>) -> Option<Commander> {
    state.lock().unwrap().active_commander.clone()
}

#[tauri::command]
pub fn events_get_all(conn: State<'_, Arc<Mutex<Connection>>>) -> Vec<GameEvent> {
    database::get_all_events(&conn.lock().unwrap())
}

#[tauri::command]
pub fn bodies_get(
    system_address: i64,
    conn: State<'_, Arc<Mutex<Connection>>>,
) -> Vec<SystemBody> {
    database::get_bodies_by_system(&conn.lock().unwrap(), system_address)
}

#[tauri::command]
pub fn history_get(conn: State<'_, Arc<Mutex<Connection>>>) -> Vec<SystemVisit> {
    database::get_systems_visited(&conn.lock().unwrap())
}

#[tauri::command]
pub fn system_stats(
    system_address: i64,
    conn: State<'_, Arc<Mutex<Connection>>>,
) -> Option<SystemStats> {
    database::get_system_stats(&conn.lock().unwrap(), system_address)
}

#[tauri::command]
pub fn bio_scans_get(
    system_address: i64,
    conn: State<'_, Arc<Mutex<Connection>>>,
) -> Vec<BioScan> {
    database::get_bio_scans_by_system(&conn.lock().unwrap(), system_address)
}

#[tauri::command]
pub fn bio_scans_get_all(
    conn: State<'_, Arc<Mutex<Connection>>>,
) -> Vec<BioScan> {
    database::get_all_bio_scans(&conn.lock().unwrap())
}

#[tauri::command]
pub fn bio_scan_set_value(
    id: i64,
    base_value: i64,
    conn: State<'_, Arc<Mutex<Connection>>>,
) {
    database::set_bio_scan_value(&conn.lock().unwrap(), id, base_value);
}
