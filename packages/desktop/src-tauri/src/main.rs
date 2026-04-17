#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use coda_desktop_lib::{fs_commands, workspace_registry, AppState};

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

fn main() {
    let state = AppState::with_fresh_token();
    // Pre-load persisted workspaces so the UI sees them on first query
    // and allowed_roots is seeded before any fs_command can fire.
    let _ = workspace_registry::ensure_loaded(&state);
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            ping,
            fs_commands::list_directory,
            fs_commands::read_text_file,
            fs_commands::write_text_file,
            workspace_registry::register_workspace,
            workspace_registry::unregister_workspace,
            workspace_registry::list_workspaces,
            workspace_registry::get_last_selected_workspace,
            workspace_registry::set_last_selected_workspace,
        ])
        .run(tauri::generate_context!())
        .expect("error running coda desktop");
}
