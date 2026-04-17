#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use coda_desktop_lib::AppState;

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

fn main() {
    let state = AppState::with_fresh_token();
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error running coda desktop");
}
