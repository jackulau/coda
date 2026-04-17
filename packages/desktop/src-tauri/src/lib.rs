use std::sync::Mutex;

pub mod lsp_spawn;
pub mod sidecar_token;
pub mod url_guard;

#[cfg(test)]
mod lsp_spawn_test;

#[cfg(test)]
mod tests_extra;

pub use sidecar_token::SessionToken;
pub use url_guard::is_local_url;

#[derive(Default)]
pub struct AppState {
    pub session_token: Mutex<Option<SessionToken>>,
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
        let src =
            std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read main.rs: {e}"));
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
            "fs:allow-read-text-file",
            "fs:allow-write-text-file",
            "fs:allow-read-dir",
            "opener:allow-reveal-item-in-dir",
        ] {
            assert!(
                perm_ids.contains(&required),
                "capability file missing required permission: {required}"
            );
        }
    }
}
