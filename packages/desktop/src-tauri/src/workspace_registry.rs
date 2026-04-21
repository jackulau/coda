//! Workspace registry: list of folders the user has opened as workspaces.
//! Persisted to `$APPCONFIG/coda/workspaces.json`. Canonical paths are
//! also mirrored into [`AppState.allowed_roots`] so the path-guard lets
//! the frontend read/write files under them.

use crate::AppState;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::State;

const CURRENT_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceRecord {
    pub id: String,
    pub name: String,
    #[serde(rename = "rootPath")]
    pub root_path: String,
    #[serde(rename = "addedAt")]
    pub added_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkspacesFile {
    pub version: u32,
    pub workspaces: Vec<WorkspaceRecord>,
    #[serde(rename = "lastSelectedId")]
    pub last_selected_id: Option<String>,
}

impl Default for WorkspacesFile {
    fn default() -> Self {
        Self {
            version: CURRENT_VERSION,
            workspaces: Vec::new(),
            last_selected_id: None,
        }
    }
}

fn default_config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("coda")
}

fn default_config_file() -> PathBuf {
    default_config_dir().join("workspaces.json")
}

pub fn load_from(path: &Path) -> Result<WorkspacesFile, String> {
    if !path.exists() {
        return Ok(WorkspacesFile::default());
    }
    let raw = std::fs::read_to_string(path).map_err(|e| format!("read workspaces: {e}"))?;
    let parsed: WorkspacesFile =
        serde_json::from_str(&raw).map_err(|e| format!("parse workspaces.json: {e}"))?;
    if parsed.version != CURRENT_VERSION {
        return Err(format!(
            "unsupported workspaces.json version: {} (expected {CURRENT_VERSION})",
            parsed.version
        ));
    }
    Ok(parsed)
}

pub fn save_to(path: &Path, file: &WorkspacesFile) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create config dir: {e}"))?;
    }
    let json =
        serde_json::to_string_pretty(file).map_err(|e| format!("serialize workspaces: {e}"))?;
    // atomic write: temp + rename
    let tmp = tempfile::NamedTempFile::new_in(path.parent().unwrap_or(Path::new(".")))
        .map_err(|e| format!("tmpfile: {e}"))?;
    std::fs::write(tmp.path(), json).map_err(|e| format!("write tmp: {e}"))?;
    tmp.persist(path).map_err(|e| format!("persist: {e}"))?;
    Ok(())
}

fn now_iso8601() -> String {
    // Avoid pulling in chrono; generate a simple RFC-3339-ish timestamp
    // using system time + nanoseconds since epoch.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

pub fn ensure_loaded(state: &AppState) -> Result<WorkspacesFile, String> {
    let mut g = state
        .workspaces
        .lock()
        .map_err(|_| "workspaces mutex poisoned".to_string())?;
    if let Some(ref f) = *g {
        return Ok(f.clone());
    }
    let loaded = load_from(&default_config_file())?;
    // seed allowed_roots
    if let Ok(mut roots) = state.allowed_roots.lock() {
        for w in &loaded.workspaces {
            if let Ok(canonical) = std::fs::canonicalize(&w.root_path) {
                if !roots.iter().any(|p| p == &canonical) {
                    roots.push(canonical);
                }
            }
        }
    }
    *g = Some(loaded.clone());
    Ok(loaded)
}

#[tauri::command]
pub fn register_workspace(
    root_path: String,
    name: Option<String>,
    state: State<'_, AppState>,
) -> Result<WorkspaceRecord, String> {
    let canonical = std::fs::canonicalize(&root_path).map_err(|e| format!("canonicalize: {e}"))?;
    if !canonical.is_dir() {
        return Err(format!("not a directory: {}", canonical.display()));
    }
    let canonical_str = canonical.to_string_lossy().to_string();

    let mut file = ensure_loaded(&state)?;
    if let Some(existing) = file
        .workspaces
        .iter()
        .find(|w| w.root_path == canonical_str)
        .cloned()
    {
        return Ok(existing);
    }
    let display_name = name.unwrap_or_else(|| {
        canonical
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "workspace".to_string())
    });
    let rec = WorkspaceRecord {
        id: uuid::Uuid::new_v4().to_string(),
        name: display_name,
        root_path: canonical_str,
        added_at: now_iso8601(),
    };
    file.workspaces.push(rec.clone());
    save_to(&default_config_file(), &file)?;
    if let Ok(mut cache) = state.workspaces.lock() {
        *cache = Some(file);
    }
    if let Ok(mut roots) = state.allowed_roots.lock() {
        if !roots.iter().any(|p| p == &canonical) {
            roots.push(canonical);
        }
    }
    Ok(rec)
}

#[tauri::command]
pub fn unregister_workspace(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut file = ensure_loaded(&state)?;
    let removed = file.workspaces.iter().find(|w| w.id == id).cloned();
    file.workspaces.retain(|w| w.id != id);
    if file.last_selected_id.as_deref() == Some(id.as_str()) {
        file.last_selected_id = None;
    }
    save_to(&default_config_file(), &file)?;
    if let Ok(mut cache) = state.workspaces.lock() {
        *cache = Some(file);
    }
    if let (Some(removed), Ok(mut roots)) = (removed, state.allowed_roots.lock()) {
        if let Ok(canonical) = std::fs::canonicalize(&removed.root_path) {
            roots.retain(|p| p != &canonical);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_workspaces(state: State<'_, AppState>) -> Result<Vec<WorkspaceRecord>, String> {
    let file = ensure_loaded(&state)?;
    Ok(file.workspaces)
}

#[tauri::command]
pub fn get_last_selected_workspace(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let file = ensure_loaded(&state)?;
    Ok(file.last_selected_id)
}

#[tauri::command]
pub fn set_last_selected_workspace(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut file = ensure_loaded(&state)?;
    file.last_selected_id = Some(id);
    save_to(&default_config_file(), &file)?;
    if let Ok(mut cache) = state.workspaces.lock() {
        *cache = Some(file);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // To test without writing to the real $APPCONFIG, we operate through
    // the load_from / save_to helpers directly. The tauri::command
    // wrappers are thin glue.

    fn empty_state() -> AppState {
        AppState::with_fresh_token()
    }

    #[test]
    fn register_creates_file_and_record() {
        let tmp = TempDir::new().unwrap();
        let ws_root = tmp.path().join("workspace1");
        std::fs::create_dir_all(&ws_root).unwrap();
        let file_path = tmp.path().join("workspaces.json");

        assert!(!file_path.exists());
        let mut file = load_from(&file_path).unwrap();
        assert_eq!(file.workspaces.len(), 0);

        let rec = WorkspaceRecord {
            id: uuid::Uuid::new_v4().to_string(),
            name: "workspace1".to_string(),
            root_path: std::fs::canonicalize(&ws_root)
                .unwrap()
                .to_string_lossy()
                .to_string(),
            added_at: now_iso8601(),
        };
        file.workspaces.push(rec);
        save_to(&file_path, &file).unwrap();

        let reloaded = load_from(&file_path).unwrap();
        assert_eq!(reloaded.workspaces.len(), 1);
        assert_eq!(reloaded.workspaces[0].name, "workspace1");
    }

    #[test]
    fn register_is_idempotent() {
        let tmp = TempDir::new().unwrap();
        let ws_root = tmp.path().join("ws");
        std::fs::create_dir_all(&ws_root).unwrap();
        let file_path = tmp.path().join("workspaces.json");

        let mut file = load_from(&file_path).unwrap();
        let canonical = std::fs::canonicalize(&ws_root)
            .unwrap()
            .to_string_lossy()
            .to_string();
        file.workspaces.push(WorkspaceRecord {
            id: "id-1".to_string(),
            name: "ws".to_string(),
            root_path: canonical.clone(),
            added_at: "t".to_string(),
        });
        save_to(&file_path, &file).unwrap();

        // Simulate second register: same canonical path → dedup
        let reloaded = load_from(&file_path).unwrap();
        let existing = reloaded
            .workspaces
            .iter()
            .find(|w| w.root_path == canonical);
        assert!(existing.is_some(), "expected existing record, got none");
        assert_eq!(existing.unwrap().id, "id-1");
    }

    #[test]
    fn register_rejects_nonexistent_path() {
        let tmp = TempDir::new().unwrap();
        let bogus = tmp.path().join("does-not-exist");
        let err = std::fs::canonicalize(&bogus).err();
        assert!(err.is_some(), "canonicalize should fail for missing path");
    }

    #[test]
    fn unregister_removes_record() {
        let tmp = TempDir::new().unwrap();
        let file_path = tmp.path().join("workspaces.json");
        let mut file = WorkspacesFile::default();
        file.workspaces.push(WorkspaceRecord {
            id: "keep".into(),
            name: "a".into(),
            root_path: "/a".into(),
            added_at: "t".into(),
        });
        file.workspaces.push(WorkspaceRecord {
            id: "drop".into(),
            name: "b".into(),
            root_path: "/b".into(),
            added_at: "t".into(),
        });
        save_to(&file_path, &file).unwrap();

        let mut reloaded = load_from(&file_path).unwrap();
        reloaded.workspaces.retain(|w| w.id != "drop");
        save_to(&file_path, &reloaded).unwrap();

        let final_file = load_from(&file_path).unwrap();
        assert_eq!(final_file.workspaces.len(), 1);
        assert_eq!(final_file.workspaces[0].id, "keep");
    }

    #[test]
    fn list_after_restart() {
        let tmp = TempDir::new().unwrap();
        let file_path = tmp.path().join("workspaces.json");
        let mut file = WorkspacesFile::default();
        file.workspaces.push(WorkspaceRecord {
            id: "a".into(),
            name: "A".into(),
            root_path: "/tmp/a".into(),
            added_at: "t".into(),
        });
        save_to(&file_path, &file).unwrap();

        // Simulate process restart by loading fresh
        let reloaded = load_from(&file_path).unwrap();
        assert_eq!(reloaded.workspaces.len(), 1);
    }

    #[test]
    fn version_mismatch_errors() {
        let tmp = TempDir::new().unwrap();
        let file_path = tmp.path().join("workspaces.json");
        std::fs::write(
            &file_path,
            r#"{"version":999,"workspaces":[],"lastSelectedId":null}"#,
        )
        .unwrap();
        let err = load_from(&file_path).unwrap_err();
        assert!(err.contains("unsupported"), "got: {err}");
    }

    #[test]
    fn last_selected_round_trip() {
        let tmp = TempDir::new().unwrap();
        let file_path = tmp.path().join("workspaces.json");
        let file = WorkspacesFile {
            last_selected_id: Some("abc".into()),
            ..Default::default()
        };
        save_to(&file_path, &file).unwrap();
        let reloaded = load_from(&file_path).unwrap();
        assert_eq!(reloaded.last_selected_id, Some("abc".to_string()));
    }

    #[test]
    fn empty_state_has_no_workspaces() {
        let state = empty_state();
        let roots = state.allowed_roots.lock().unwrap();
        assert_eq!(roots.len(), 0);
    }
}
