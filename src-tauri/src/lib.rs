mod commands;
mod config;
mod database;
mod state;
mod types;
mod watcher;

use config::read_config;
use database::{db_path, get_last_commander, init_database};
use state::AppState;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use types::Commander;
use watcher::{begin_polling, find_latest_file, start_watching};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::folder_set,
            commands::folder_get,
            commands::file_stop,
            commands::commander_get,
            commands::events_get_all,
            commands::bodies_get,
            commands::history_get,
            commands::system_stats,
            commands::bio_scans_get,
            commands::bio_scan_set_value,
            commands::bio_scans_get_all,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Ensure app data dir exists
            let data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).ok();

            // Initialize database
            let db_file = db_path(&app_handle);
            let conn = init_database(&db_file);
            let conn = Arc::new(Mutex::new(conn));
            app.manage(conn.clone());

            // Restore last commander
            let active_commander = {
                let conn_guard = conn.lock().unwrap();
                get_last_commander(&conn_guard).map(|(fid, name, current_system, system_name)| {
                    Commander {
                        fid,
                        name,
                        current_system,
                        current_system_name: system_name,
                    }
                })
            };

            let app_state = Arc::new(Mutex::new(AppState::new()));
            {
                let mut s = app_state.lock().unwrap();
                s.active_commander = active_commander;
            }
            app.manage(app_state.clone());

            // Auto-start watching if a folder was previously saved
            let config = read_config(&app_handle);
            if let Some(folder) = config.folder {
                let folder_path = std::path::PathBuf::from(&folder);
                if let Some(file) = find_latest_file(&folder_path) {
                    let filename = file
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let file_str = file.to_string_lossy().to_string();

                    let app_state_for_thread = app_state.clone();
                    start_watching(file, app_handle.clone(), conn, app_state);

                    // Emit file:watching and commander:active once the window is ready.
                    // commander:active fires immediately from read_file_header but the webview
                    // may not have its listener registered yet, so we re-emit it here.
                    let app_handle2 = app_handle.clone();
                    let info = types::WatchingInfo {
                        folder,
                        file: Some(file_str),
                        filename: Some(filename),
                        scanning: false,
                    };
                    std::thread::spawn(move || {
                        // Small delay to ensure the webview is ready
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        app_handle2.emit("file:watching", info).ok();
                        let cmdr = app_state_for_thread.lock().unwrap().active_commander.clone();
                        if let Some(cmdr) = cmdr {
                            app_handle2.emit("commander:active", cmdr).ok();
                        }
                    });
                } else {
                    begin_polling(folder_path, app_handle, conn, app_state);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
