#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use coda_desktop_lib::AppState;

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

fn main() {
    let state = AppState::with_fresh_token();
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error running coda desktop");
}
