use crate::config::read_config;
use crate::database;
use crate::state::AppState;
use crate::types::{Commander, GameEvent, WatchingInfo};
use notify::{Config as NotifyConfig, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use regex::Regex;
use rusqlite::Connection;
use serde_json::Value;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

const POLL_INTERVAL_SECS: u64 = 5;
const IGNORED_EVENTS: &[&str] = &["Music", "ReservoirReplenished"];

fn journal_filename_regex() -> Regex {
    Regex::new(r"^Journal\.\d{4}-\d{2}-\d{2}T\d{6}\.\d+\.log$").unwrap()
}

/// Reads the last 4 KB of a file and checks if any of the final lines
/// contain a JSON object with event === 'Shutdown'.
pub fn has_shutdown_at_end(file_path: &Path) -> bool {
    const TAIL_BYTES: u64 = 4096;

    let mut file = match std::fs::File::open(file_path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let size = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => return false,
    };

    let read_size = TAIL_BYTES.min(size) as usize;
    let offset = size.saturating_sub(TAIL_BYTES);
    if file.seek(SeekFrom::Start(offset)).is_err() {
        return false;
    }

    let mut buf = vec![0u8; read_size];
    if file.read_exact(&mut buf).is_err() {
        return false;
    }

    let content = String::from_utf8_lossy(&buf);
    let lines: Vec<&str> = content
        .split('\n')
        .filter(|l| !l.trim().is_empty())
        .collect();

    let start = lines.len().saturating_sub(5);
    for line in &lines[start..] {
        if let Ok(parsed) = serde_json::from_str::<Value>(line.trim()) {
            if parsed["event"].as_str() == Some("Shutdown") {
                return true;
            }
        }
    }
    false
}

/// Returns the newest file in the folder that does not end with a Shutdown event.
pub fn find_latest_file(folder: &Path) -> Option<PathBuf> {
    let re = journal_filename_regex();

    let entries = std::fs::read_dir(folder).ok()?;
    let mut files: Vec<(PathBuf, u128)> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().map(|ft| ft.is_file()).unwrap_or(false)
                && re.is_match(&e.file_name().to_string_lossy())
        })
        .filter_map(|e| {
            let path = e.path();
            let mtime = path
                .metadata()
                .ok()?
                .modified()
                .ok()?
                .duration_since(std::time::UNIX_EPOCH)
                .ok()?
                .as_millis();
            Some((path, mtime))
        })
        .collect();

    files.sort_by(|a, b| b.1.cmp(&a.1)); // newest first

    for (path, _) in files {
        if !has_shutdown_at_end(&path) {
            return Some(path);
        }
    }
    None
}

pub fn parse_line(line: &str) -> Option<GameEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let parsed: Value = serde_json::from_str(trimmed).ok()?;
    let event_type = parsed["event"].as_str().unwrap_or("unknown").to_string();

    if IGNORED_EVENTS.contains(&event_type.as_str()) {
        return None;
    }

    Some(GameEvent {
        _id: format!("{}", Uuid::new_v4()),
        event_type,
        raw: trimmed.to_string(),
        data: parsed,
        commander: None,
    })
}

/// Reads the first 8 KB of a new journal file to find the Commander event,
/// upserts into the DB, and emits commander:active to the window.
pub fn read_file_header(
    file_path: &Path,
    conn: &Connection,
    state: &mut AppState,
    app: &AppHandle,
) {
    const HEADER_BYTES: usize = 8192;

    let mut file = match std::fs::File::open(file_path) {
        Ok(f) => f,
        Err(_) => return,
    };
    let size = match file.metadata() {
        Ok(m) => m.len() as usize,
        Err(_) => return,
    };

    let read_size = HEADER_BYTES.min(size);
    let mut buf = vec![0u8; read_size];
    if file.read_exact(&mut buf).is_err() {
        return;
    }

    let content = String::from_utf8_lossy(&buf);
    let mut cmdr_fid: Option<String> = None;

    for line in content.split('\n') {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let parsed: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => continue,
        };

        if parsed["event"].as_str() == Some("Commander") {
            if let (Some(fid), Some(name)) = (
                parsed["FID"].as_str(),
                parsed["Name"].as_str(),
            ) {
                database::upsert_commander(conn, fid, name);
                cmdr_fid = Some(fid.to_string());
                state.active_commander = Some(Commander {
                    fid: fid.to_string(),
                    name: name.to_string(),
                    current_system: None,
                    current_system_name: None,
                });
                app.emit("commander:active", state.active_commander.clone()).ok();
                continue;
            }
        }

        if parsed["event"].as_str() == Some("Location") {
            if let (Some(sa), Some(system_name)) = (
                parsed["SystemAddress"].as_i64(),
                parsed["StarSystem"].as_str(),
            ) {
                let star_pos = &parsed["StarPos"];
                let x = star_pos.get(0).and_then(|v| v.as_f64());
                let y = star_pos.get(1).and_then(|v| v.as_f64());
                let z = star_pos.get(2).and_then(|v| v.as_f64());
                database::upsert_system_from_location(conn, sa, system_name, x, y, z);

                if let Some(fid) = &cmdr_fid {
                    database::update_commander_system(conn, fid, sa);
                    if let Some(cmdr) = &mut state.active_commander {
                        cmdr.current_system = Some(sa);
                        cmdr.current_system_name = Some(system_name.to_string());
                    }
                    app.emit("commander:active", state.active_commander.clone()).ok();
                }
                return; // Location is always the last header event we need
            }
        }
    }
}

pub fn read_new_lines(
    app: &AppHandle,
    conn: &Arc<Mutex<Connection>>,
    state: &Arc<Mutex<AppState>>,
) {
    let file_path = {
        let s = state.lock().unwrap();
        s.watched_file.clone()
    };
    let file_path = match file_path {
        Some(p) => p,
        None => return,
    };

    let file_size = match file_path.metadata() {
        Ok(m) => m.len(),
        Err(_) => return,
    };

    {
        let mut s = state.lock().unwrap();
        if file_size < s.file_position {
            s.file_position = 0;
        }
        if file_size == s.file_position {
            return;
        }
    }

    let start = {
        let s = state.lock().unwrap();
        s.file_position
    };

    let mut file = match std::fs::File::open(&file_path) {
        Ok(f) => f,
        Err(_) => return,
    };
    if file.seek(SeekFrom::Start(start)).is_err() {
        return;
    }

    let read_len = (file_size - start) as usize;
    let mut buf = vec![0u8; read_len];
    if file.read_exact(&mut buf).is_err() {
        return;
    }

    {
        let mut s = state.lock().unwrap();
        s.file_position = file_size;
    }

    let content = String::from_utf8_lossy(&buf);
    let conn_guard = conn.lock().unwrap();

    for line in content.split('\n') {
        let mut event = match parse_line(line) {
            Some(e) => e,
            None => continue,
        };

        let active_cmdr = {
            let s = state.lock().unwrap();
            s.active_commander.clone()
        };

        event.commander = active_cmdr.as_ref().map(|c| c.fid.clone());
        database::insert_event(&conn_guard, &event, event.commander.as_deref());
        app.emit("event:new", &event).ok();

        let event_type = event.event_type.as_str();
        let data = &event.data;

        if event_type == "Location" {
            if let (Some(sa), Some(system_name)) =
                (data["SystemAddress"].as_i64(), data["StarSystem"].as_str())
            {
                let star_pos = &data["StarPos"];
                let x = star_pos.get(0).and_then(|v| v.as_f64());
                let y = star_pos.get(1).and_then(|v| v.as_f64());
                let z = star_pos.get(2).and_then(|v| v.as_f64());
                database::upsert_system_from_location(&conn_guard, sa, system_name, x, y, z);

                let mut s = state.lock().unwrap();
                if let Some(cmdr) = &mut s.active_commander {
                    database::update_commander_system(&conn_guard, &cmdr.fid.clone(), sa);
                    cmdr.current_system = Some(sa);
                    cmdr.current_system_name = Some(system_name.to_string());
                    app.emit("commander:active", cmdr.clone()).ok();
                }
            }
        }

        if event_type == "StartJump" {
            if let (Some(sa), Some(system_name)) =
                (data["SystemAddress"].as_i64(), data["StarSystem"].as_str())
            {
                let mut s = state.lock().unwrap();
                if let Some(cmdr) = &mut s.active_commander {
                    database::update_commander_system(&conn_guard, &cmdr.fid.clone(), sa);
                    cmdr.current_system = Some(sa);
                    cmdr.current_system_name = Some(system_name.to_string());
                    app.emit("commander:active", cmdr.clone()).ok();
                }
            }
        }

        if event_type == "FSDJump" {
            if let (Some(sa), Some(system_name)) =
                (data["SystemAddress"].as_i64(), data["StarSystem"].as_str())
            {
                let mut s = state.lock().unwrap();
                if let Some(cmdr) = &mut s.active_commander {
                    database::update_commander_system(&conn_guard, &cmdr.fid.clone(), sa);
                    cmdr.current_system = Some(sa);
                    cmdr.current_system_name = Some(system_name.to_string());
                    app.emit("commander:active", cmdr.clone()).ok();
                }
            }
            app.emit("history:updated", ()).ok();
        }

        if event_type == "FSSAllBodiesFound" {
            if let Some(sa) = data["SystemAddress"].as_i64() {
                database::mark_all_bodies_found(&conn_guard, sa);
            }
        }

        if event_type == "Scan" {
            if let Some(body_name) = data["BodyName"].as_str() {
                if data["WasDiscovered"].as_bool() == Some(false) {
                    let cmdr_name = {
                        state
                            .lock()
                            .unwrap()
                            .active_commander
                            .as_ref()
                            .map(|c| c.name.clone())
                    };
                    if let Some(name) = cmdr_name {
                        database::update_body_discovered_by(&conn_guard, body_name, &name);
                    }
                }
            }
            let (sa, current_sa) = {
                let s = state.lock().unwrap();
                (
                    data["SystemAddress"].as_i64(),
                    s.active_commander.as_ref().and_then(|c| c.current_system),
                )
            };
            if let Some(sa) = sa {
                if Some(sa) == current_sa {
                    app.emit("bodies:updated", sa).ok();
                }
            }
        }

        if event_type == "SAAScanComplete" {
            if let Some(body_name) = data["BodyName"].as_str() {
                let cmdr_name = {
                    state
                        .lock()
                        .unwrap()
                        .active_commander
                        .as_ref()
                        .map(|c| c.name.clone())
                };
                if let Some(name) = cmdr_name {
                    database::update_body_mapped_by(&conn_guard, body_name, &name);
                }
            }
            let (sa, current_sa) = {
                let s = state.lock().unwrap();
                (
                    data["SystemAddress"].as_i64(),
                    s.active_commander.as_ref().and_then(|c| c.current_system),
                )
            };
            if let Some(sa) = sa {
                if Some(sa) == current_sa {
                    app.emit("bodies:updated", sa).ok();
                }
            }
        }

        if event_type == "FSSBodySignals" {
            let (sa, current_sa) = {
                let s = state.lock().unwrap();
                (
                    data["SystemAddress"].as_i64(),
                    s.active_commander.as_ref().and_then(|c| c.current_system),
                )
            };
            if let Some(sa) = sa {
                if Some(sa) == current_sa {
                    app.emit("bodies:updated", sa).ok();
                }
            }
        }

        if event_type == "Shutdown" {
            let folder = read_config(app).folder;
            stop_watching(state);
            if let Some(folder) = folder {
                begin_polling(PathBuf::from(folder), app.clone(), conn.clone(), state.clone());
            }
            return;
        }
    }
}

pub fn stop_watching(state: &Arc<Mutex<AppState>>) {
    let mut s = state.lock().unwrap();
    s.watcher = None;
    s.watched_file = None;
}

pub fn stop_polling(state: &Arc<Mutex<AppState>>) {
    let mut s = state.lock().unwrap();
    if let Some(handle) = s.poll_handle.take() {
        handle.abort();
    }
}

pub fn start_watching(
    file_path: PathBuf,
    app: AppHandle,
    conn: Arc<Mutex<Connection>>,
    state: Arc<Mutex<AppState>>,
) {
    stop_polling(&state);
    stop_watching(&state);

    {
        let mut s = state.lock().unwrap();
        s.file_position = file_path
            .metadata()
            .map(|m| m.len())
            .unwrap_or(0);
        s.watched_file = Some(file_path.clone());
    }

    // Read the file header to get commander info
    {
        let conn_guard = conn.lock().unwrap();
        let mut s = state.lock().unwrap();
        read_file_header(&file_path, &conn_guard, &mut s, &app);
    }

    let app_clone = app.clone();
    let conn_clone = conn.clone();
    let state_clone = state.clone();

    let (tx, rx) = std::sync::mpsc::channel();
    let mut watcher = RecommendedWatcher::new(tx, NotifyConfig::default())
        .expect("failed to create file watcher");

    watcher
        .watch(&file_path, RecursiveMode::NonRecursive)
        .expect("failed to watch file");

    {
        let mut s = state.lock().unwrap();
        s.watcher = Some(watcher);
    }

    std::thread::spawn(move || {
        for result in rx {
            match result {
                Ok(event) => {
                    if matches!(
                        event.kind,
                        EventKind::Modify(_) | EventKind::Create(_)
                    ) {
                        read_new_lines(&app_clone, &conn_clone, &state_clone);
                    }
                }
                Err(_) => break,
            }
        }
    });
}

pub fn begin_polling(
    folder: PathBuf,
    app: AppHandle,
    conn: Arc<Mutex<Connection>>,
    state: Arc<Mutex<AppState>>,
) {
    stop_polling(&state);

    // Try immediately
    if let Some(file) = find_latest_file(&folder) {
        start_watching(file.clone(), app.clone(), conn, state);
        let filename = file.file_name().unwrap_or_default().to_string_lossy().to_string();
        app.emit(
            "file:watching",
            WatchingInfo {
                folder: folder.to_string_lossy().to_string(),
                file: Some(file.to_string_lossy().to_string()),
                filename: Some(filename),
                scanning: false,
            },
        )
        .ok();
        return;
    }

    // Emit scanning state
    app.emit(
        "file:watching",
        WatchingInfo {
            folder: folder.to_string_lossy().to_string(),
            file: None,
            filename: None,
            scanning: true,
        },
    )
    .ok();

    let app_clone = app.clone();
    let conn_clone = conn.clone();
    let state_clone = state.clone();
    let folder_clone = folder.clone();

    let handle = tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;
            if let Some(file) = find_latest_file(&folder_clone) {
                let filename = file
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                start_watching(file.clone(), app_clone.clone(), conn_clone.clone(), state_clone.clone());
                app_clone
                    .emit(
                        "file:watching",
                        WatchingInfo {
                            folder: folder_clone.to_string_lossy().to_string(),
                            file: Some(file.to_string_lossy().to_string()),
                            filename: Some(filename),
                            scanning: false,
                        },
                    )
                    .ok();
                break;
            }
        }
    });

    let mut s = state.lock().unwrap();
    s.poll_handle = Some(handle);
}
