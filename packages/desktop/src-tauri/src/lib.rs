use std::path::PathBuf;
use std::sync::Mutex;

pub mod fs_commands;
pub mod git_commands;
pub mod lsp_spawn;
pub mod path_guard;
pub mod pty;
pub mod sidecar_token;
pub mod url_guard;
pub mod workspace_registry;

#[cfg(test)]
mod lsp_spawn_test;

#[cfg(test)]
mod tests_extra;

pub use sidecar_token::SessionToken;
pub use url_guard::is_local_url;

#[derive(Default)]
pub struct AppState {
    pub session_token: Mutex<Option<SessionToken>>,
    /// Canonical paths that `fs_commands` will accept. Populated at
    /// startup from [`workspace_registry::load_workspaces`] and mutated
    /// by the `register_workspace` / `unregister_workspace` commands.
    pub allowed_roots: Mutex<Vec<PathBuf>>,
    /// In-memory cache of persisted workspaces.
    pub workspaces: Mutex<Option<workspace_registry::WorkspacesFile>>,
}

impl AppState {
    pub fn with_fresh_token() -> Self {
        let s = Self::default();
        if let Ok(mut g) = s.session_token.lock() {
            *g = Some(SessionToken::generate());
        }
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_state_seeds_session_token() {
        let s = AppState::with_fresh_token();
        let g = s.session_token.lock().expect("lock");
        let token = g.as_ref().expect("token populated");
        assert_eq!(token.value.len(), 64);
    }
}

#[cfg(test)]
mod plugin_tests {
    /// Assert the main binary registers the three Tauri plugins we rely on.
    /// This is a source-grep test rather than a runtime test because spinning
    /// up a full Tauri builder inside a cargo-test requires a display server
    /// — we just need to catch "someone deleted the plugin(...) line".
    #[test]
    fn app_builder_registers_plugins() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src")
            .join("main.rs");
        let src = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read main.rs: {e}"));
        for expected in [
            "tauri_plugin_fs::init()",
            "tauri_plugin_dialog::init()",
            "tauri_plugin_opener::init()",
        ] {
            assert!(
                src.contains(expected),
                "main.rs missing plugin registration: {expected}"
            );
        }
    }

    /// The capability file must NOT grant the built-in tauri-plugin-fs IPC
    /// surface — our custom path-guarded commands are the only allowed
    /// filesystem entry point. If `fs:allow-*` ever re-appears, a renderer
    /// XSS or compromised dep can bypass `path_guard.rs` and read/write any
    /// path on the user's disk.
    #[test]
    fn capability_file_does_not_grant_unscoped_fs_access() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("capabilities")
            .join("default.json");
        let raw = std::fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("read {}: {}", path.display(), e));
        let json: serde_json::Value = serde_json::from_str(&raw).expect("valid JSON");
        let perms = json
            .get("permissions")
            .and_then(|v| v.as_array())
            .expect("permissions array");
        let perm_ids: Vec<&str> = perms.iter().filter_map(|v| v.as_str()).collect();
        for forbidden in [
            "fs:default",
            "fs:allow-read-text-file",
            "fs:allow-write-text-file",
            "fs:allow-read-dir",
            "fs:allow-exists",
            "fs:allow-mkdir",
        ] {
            assert!(
                !perm_ids.contains(&forbidden),
                "capability file must NOT grant {forbidden} — use custom commands instead"
            );
        }
    }

    /// The capability file must be valid JSON and list the permissions the
    /// frontend depends on. This guards against accidental deletion / typo
    /// in `capabilities/default.json` — if any required permission is
    /// removed, the UI silently stops being able to call the plugin.
    #[test]
    fn capability_file_parses_with_required_permissions() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("capabilities")
            .join("default.json");
        let raw = std::fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("read {}: {}", path.display(), e));
        let json: serde_json::Value = serde_json::from_str(&raw).expect("valid JSON");
        let perms = json
            .get("permissions")
            .and_then(|v| v.as_array())
            .expect("permissions array");
        let perm_ids: Vec<&str> = perms.iter().filter_map(|v| v.as_str()).collect();
        for required in [
            "core:default",
            "dialog:allow-open",
            "opener:allow-reveal-item-in-dir",
        ] {
            assert!(
                perm_ids.contains(&required),
                "capability file missing required permission: {required}"
            );
        }
    }
}
