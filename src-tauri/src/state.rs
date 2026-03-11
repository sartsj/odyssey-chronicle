use crate::types::Commander;
use notify::RecommendedWatcher;
use std::path::PathBuf;
use tauri::async_runtime::JoinHandle;

pub struct AppState {
    pub active_commander: Option<Commander>,
    pub watched_file: Option<PathBuf>,
    pub file_position: u64,
    pub watcher: Option<RecommendedWatcher>,
    pub poll_handle: Option<JoinHandle<()>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            active_commander: None,
            watched_file: None,
            file_position: 0,
            watcher: None,
            poll_handle: None,
        }
    }
}
