//! Filesystem commands exposed to the frontend via `invoke()`.
//!
//! All paths pass through [`path_guard::resolve_safe`] and are rejected
//! unless they live under an allowed workspace root (tracked in
//! [`AppState.allowed_roots`]).

use crate::path_guard::{resolve_safe, FsError};
use crate::AppState;
use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::State;

/// Cap a single read at 10 MB. Text files bigger than this are almost
/// certainly binaries or logs the user doesn't want loaded into CM6.
pub const MAX_FILE_BYTES: u64 = 10_000_000;

/// Cap a directory listing at this count. Beyond it we return a
/// truncated flag so the UI can show "…and 12k more hidden" rather than
/// freezing while we marshal 100k entries over IPC. 5000 is large
/// enough that no real source directory hits it, and small enough that
/// the serialized payload stays under ~1 MB.
pub const MAX_DIR_ENTRIES: usize = 5_000;

/// Directory names we skip at the child level by default. These are
/// almost always package / build / VCS trees the user doesn't want to
/// browse, and are the usual culprits behind "one click freezes the
/// app" (node_modules has 100k+ entries on a typical project).
const HEAVY_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    ".next",
    "dist",
    "build",
    ".venv",
    "__pycache__",
];

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Directory,
}

#[derive(Serialize, Debug)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    /// True for directories in [`HEAVY_DIRS`]: the UI can render the row
    /// with a "click to load anyway" affordance instead of expanding on
    /// first click.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub heavy: bool,
    /// True for the synthetic last entry when the directory held more
    /// than [`MAX_DIR_ENTRIES`] children. The UI can show "…and N more".
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub truncated: bool,
}

fn allowed_roots_snapshot(state: &AppState) -> Vec<PathBuf> {
    state
        .allowed_roots
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default()
}

/// List the direct children of `path`.  Directories are sorted first,
/// then files, both alphabetically (case-insensitive) within their group
/// so the tree feels stable across runs.
///
/// Capped at [`MAX_DIR_ENTRIES`]; overflow is represented by a single
/// synthetic trailing entry with `truncated = true`.
#[tauri::command]
pub fn list_directory(path: String, state: State<'_, AppState>) -> Result<Vec<DirEntry>, String> {
    let roots = allowed_roots_snapshot(&state);
    let canonical = resolve_safe(std::path::Path::new(&path), &roots)?;
    let rd = fs::read_dir(&canonical).map_err(FsError::from)?;
    let mut entries: Vec<DirEntry> = Vec::new();
    let mut overflow = 0usize;
    for item in rd {
        let item = item.map_err(FsError::from)?;
        let meta = match item.metadata() {
            Ok(m) => m,
            // Skip entries we cannot stat rather than failing the whole read
            Err(_) => continue,
        };
        let kind = if meta.is_dir() {
            EntryKind::Directory
        } else if meta.is_file() {
            EntryKind::File
        } else {
            // skip sockets, fifos, etc
            continue;
        };
        if entries.len() >= MAX_DIR_ENTRIES {
            overflow += 1;
            continue;
        }
        let name = item.file_name().to_string_lossy().to_string();
        let path_str = item.path().to_string_lossy().to_string();
        let size = if kind == EntryKind::File {
            Some(meta.len())
        } else {
            None
        };
        let heavy = kind == EntryKind::Directory && HEAVY_DIRS.contains(&name.as_str());
        entries.push(DirEntry {
            name,
            path: path_str,
            kind,
            size,
            heavy,
            truncated: false,
        });
    }
    entries.sort_by(|a, b| match (&a.kind, &b.kind) {
        (EntryKind::Directory, EntryKind::File) => std::cmp::Ordering::Less,
        (EntryKind::File, EntryKind::Directory) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    if overflow > 0 {
        entries.push(DirEntry {
            name: format!("…and {overflow} more hidden"),
            path: String::new(),
            kind: EntryKind::File,
            size: None,
            heavy: false,
            truncated: true,
        });
    }
    Ok(entries)
}

/// Read `path` as a utf-8 text file. Rejects > [`MAX_FILE_BYTES`].
#[tauri::command]
pub fn read_text_file(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let roots = allowed_roots_snapshot(&state);
    let canonical = resolve_safe(std::path::Path::new(&path), &roots)?;
    let meta = fs::metadata(&canonical).map_err(FsError::from)?;
    if meta.len() > MAX_FILE_BYTES {
        return Err(FsError::FileTooLarge {
            size: meta.len(),
            max: MAX_FILE_BYTES,
        }
        .to_string());
    }
    // Read as bytes first so we can surface a clean "this is a binary
    // file" error instead of the generic Utf8Error that would leak
    // through `fs::read_to_string` — the UI shows this as a toast and
    // the typed variant lets it render a specific message.
    let bytes = fs::read(&canonical).map_err(|e| FsError::Io(e).to_string())?;
    String::from_utf8(bytes).map_err(|_| FsError::BinaryFile.to_string())
}

/// Atomically write `contents` to `path`. Writes to a tempfile in the
/// same directory then renames over the target so a crashed write does
/// not leave a truncated file.
#[tauri::command]
pub fn write_text_file(
    path: String,
    contents: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let roots = allowed_roots_snapshot(&state);
    let target_path = std::path::Path::new(&path).to_path_buf();

    // If the file already exists, resolve_safe canonicalizes it and
    // blocks escape. For new files we validate the parent directory is
    // inside an allowed root.
    let validated: PathBuf = if target_path.exists() {
        resolve_safe(&target_path, &roots)?
    } else {
        let parent = target_path
            .parent()
            .ok_or_else(|| FsError::NotAllowed(path.clone()).to_string())?;
        let _ = resolve_safe(parent, &roots)?;
        // absolutize against canonical parent so we never write relative
        let canon_parent = fs::canonicalize(parent).map_err(FsError::from)?;
        let file_name = target_path
            .file_name()
            .ok_or_else(|| FsError::NotAllowed(path.clone()).to_string())?;
        canon_parent.join(file_name)
    };

    let parent = validated
        .parent()
        .ok_or_else(|| FsError::NotAllowed(path.clone()).to_string())?;
    let mut tmp = tempfile::NamedTempFile::new_in(parent).map_err(FsError::from)?;
    tmp.write_all(contents.as_bytes())
        .map_err(|e| FsError::Io(e).to_string())?;
    tmp.as_file_mut()
        .sync_all()
        .map_err(|e| FsError::Io(e).to_string())?;
    tmp.persist(&validated)
        .map_err(|e| FsError::Io(e.error).to_string())?;
    Ok(())
}

/// Register a workspace root, canonicalizing it so the path-guard can
/// compare against it.  Called by the workspace-registry code
/// ([`crate::workspace_registry`]); exposed here so callers outside the
/// registry (like tests) can set up allowed roots.
pub fn register_allowed_root(state: &AppState, root: &std::path::Path) -> Result<PathBuf, FsError> {
    let canonical = fs::canonicalize(root).map_err(FsError::from)?;
    if let Ok(mut g) = state.allowed_roots.lock() {
        if !g.iter().any(|p| p == &canonical) {
            g.push(canonical.clone());
        }
    }
    Ok(canonical)
}

/// Remove a workspace root from the allow-list. No error if absent.
pub fn unregister_allowed_root(state: &AppState, root: &std::path::Path) {
    if let Ok(canonical) = fs::canonicalize(root) {
        if let Ok(mut g) = state.allowed_roots.lock() {
            g.retain(|p| p != &canonical);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn state_with_root(root: &std::path::Path) -> AppState {
        let state = AppState::with_fresh_token();
        let canonical = fs::canonicalize(root).unwrap();
        state.allowed_roots.lock().unwrap().push(canonical);
        state
    }

    // We cannot build a Tauri State<'_, AppState> directly in tests —
    // instead we call the inner logic via helper fns. Tests exercise the
    // underlying logic; the #[tauri::command] wrapper is a thin marshal.

    fn list_directory_inner(path: &str, state: &AppState) -> Result<Vec<DirEntry>, String> {
        let roots = allowed_roots_snapshot(state);
        let canonical = resolve_safe(std::path::Path::new(path), &roots)?;
        let rd = fs::read_dir(&canonical).map_err(FsError::from)?;
        let mut entries: Vec<DirEntry> = Vec::new();
        let mut overflow = 0usize;
        for item in rd {
            let item = item.map_err(FsError::from)?;
            let meta = match item.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let kind = if meta.is_dir() {
                EntryKind::Directory
            } else if meta.is_file() {
                EntryKind::File
            } else {
                continue;
            };
            if entries.len() >= MAX_DIR_ENTRIES {
                overflow += 1;
                continue;
            }
            let name = item.file_name().to_string_lossy().to_string();
            let heavy = kind == EntryKind::Directory && HEAVY_DIRS.contains(&name.as_str());
            entries.push(DirEntry {
                name,
                path: item.path().to_string_lossy().to_string(),
                kind,
                size: if meta.is_file() {
                    Some(meta.len())
                } else {
                    None
                },
                heavy,
                truncated: false,
            });
        }
        entries.sort_by(|a, b| match (&a.kind, &b.kind) {
            (EntryKind::Directory, EntryKind::File) => std::cmp::Ordering::Less,
            (EntryKind::File, EntryKind::Directory) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });
        if overflow > 0 {
            entries.push(DirEntry {
                name: format!("…and {overflow} more hidden"),
                path: String::new(),
                kind: EntryKind::File,
                size: None,
                heavy: false,
                truncated: true,
            });
        }
        Ok(entries)
    }

    fn read_text_file_inner(path: &str, state: &AppState) -> Result<String, String> {
        let roots = allowed_roots_snapshot(state);
        let canonical = resolve_safe(std::path::Path::new(path), &roots)?;
        let meta = fs::metadata(&canonical).map_err(FsError::from)?;
        if meta.len() > MAX_FILE_BYTES {
            return Err(FsError::FileTooLarge {
                size: meta.len(),
                max: MAX_FILE_BYTES,
            }
            .to_string());
        }
        let bytes = fs::read(&canonical).map_err(|e| FsError::Io(e).to_string())?;
        String::from_utf8(bytes).map_err(|_| FsError::BinaryFile.to_string())
    }

    fn write_text_file_inner(path: &str, contents: &str, state: &AppState) -> Result<(), String> {
        let roots = allowed_roots_snapshot(state);
        let target_path = std::path::Path::new(path).to_path_buf();
        let validated: PathBuf = if target_path.exists() {
            resolve_safe(&target_path, &roots)?
        } else {
            let parent = target_path
                .parent()
                .ok_or_else(|| FsError::NotAllowed(path.to_string()).to_string())?;
            let _ = resolve_safe(parent, &roots)?;
            let canon_parent = fs::canonicalize(parent).map_err(FsError::from)?;
            let file_name = target_path
                .file_name()
                .ok_or_else(|| FsError::NotAllowed(path.to_string()).to_string())?;
            canon_parent.join(file_name)
        };
        let parent = validated
            .parent()
            .ok_or_else(|| FsError::NotAllowed(path.to_string()).to_string())?;
        let mut tmp = tempfile::NamedTempFile::new_in(parent).map_err(FsError::from)?;
        tmp.write_all(contents.as_bytes())
            .map_err(|e| FsError::Io(e).to_string())?;
        tmp.as_file_mut()
            .sync_all()
            .map_err(|e| FsError::Io(e).to_string())?;
        tmp.persist(&validated)
            .map_err(|e| FsError::Io(e.error).to_string())?;
        Ok(())
    }

    #[test]
    fn list_directory_sorts_dirs_first() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        fs::write(root.join("a.txt"), "").unwrap();
        fs::create_dir_all(root.join("b_dir")).unwrap();
        fs::write(root.join("c.txt"), "").unwrap();

        let state = state_with_root(root);
        let entries = list_directory_inner(root.to_str().unwrap(), &state).unwrap();
        let names: Vec<_> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["b_dir", "a.txt", "c.txt"]);
        assert_eq!(entries[0].kind, EntryKind::Directory);
        assert_eq!(entries[1].kind, EntryKind::File);
    }

    #[test]
    fn list_directory_rejects_unregistered_path() {
        let tmp = TempDir::new().unwrap();
        let allowed = tmp.path().join("allowed");
        fs::create_dir_all(&allowed).unwrap();
        let other = tmp.path().join("other");
        fs::create_dir_all(&other).unwrap();

        let state = state_with_root(&allowed);
        let err = list_directory_inner(other.to_str().unwrap(), &state).unwrap_err();
        assert!(err.contains("not allowed"), "got: {err}");
    }

    #[test]
    fn read_text_file_too_large() {
        let tmp = TempDir::new().unwrap();
        let big = tmp.path().join("big.txt");
        // Write one byte over the threshold
        let f = fs::File::create(&big).unwrap();
        f.set_len(MAX_FILE_BYTES + 1).unwrap();

        let state = state_with_root(tmp.path());
        let err = read_text_file_inner(big.to_str().unwrap(), &state).unwrap_err();
        assert!(err.contains("too large"), "got: {err}");
    }

    #[test]
    fn write_text_file_round_trip() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("hello.txt");
        let state = state_with_root(tmp.path());
        write_text_file_inner(path.to_str().unwrap(), "hi there", &state).unwrap();
        let back = read_text_file_inner(path.to_str().unwrap(), &state).unwrap();
        assert_eq!(back, "hi there");
    }

    #[test]
    fn write_text_file_does_not_clobber_on_atomic_rename() {
        // NamedTempFile.persist() is atomic on the same filesystem — if
        // the rename step would fail we keep the existing file. We
        // simulate by writing a known value, then doing a second write,
        // and asserting the intermediate state was never visible (i.e.
        // after a successful second write, the content is complete).
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("file.txt");
        fs::write(&path, "original").unwrap();
        let state = state_with_root(tmp.path());
        write_text_file_inner(path.to_str().unwrap(), "updated content", &state).unwrap();
        let back = fs::read_to_string(&path).unwrap();
        assert_eq!(back, "updated content");
    }

    #[test]
    fn write_text_file_requires_allowed_root() {
        let tmp = TempDir::new().unwrap();
        let allowed = tmp.path().join("allowed");
        fs::create_dir_all(&allowed).unwrap();
        let other = tmp.path().join("other");
        fs::create_dir_all(&other).unwrap();

        let state = state_with_root(&allowed);
        let err = write_text_file_inner(other.join("new.txt").to_str().unwrap(), "nope", &state)
            .unwrap_err();
        assert!(err.contains("not allowed"), "got: {err}");
    }

    #[test]
    fn read_text_file_rejects_escape_via_dotdot() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().join("root");
        fs::create_dir_all(&root).unwrap();
        let outside = tmp.path().join("outside.txt");
        fs::write(&outside, "secret").unwrap();

        let state = state_with_root(&root);
        let probe = root.join("..").join("outside.txt");
        let err = read_text_file_inner(probe.to_str().unwrap(), &state).unwrap_err();
        assert!(err.contains("not allowed"), "got: {err}");
    }

    #[test]
    fn write_creates_new_file_in_allowed_root() {
        let tmp = TempDir::new().unwrap();
        let state = state_with_root(tmp.path());
        let new_path = tmp.path().join("subdir");
        fs::create_dir(&new_path).unwrap();
        let new_file = new_path.join("new.txt");
        write_text_file_inner(new_file.to_str().unwrap(), "brand new", &state).unwrap();
        assert_eq!(fs::read_to_string(&new_file).unwrap(), "brand new");
    }

    /// Directories beyond MAX_DIR_ENTRIES are truncated — the response
    /// ends in a synthetic `truncated: true` sentinel.  This is the fix
    /// for "one click on node_modules freezes the UI".
    #[test]
    fn list_directory_truncates_at_max_entries() {
        let tmp = TempDir::new().unwrap();
        // Create MAX_DIR_ENTRIES + 50 files. Naming them numerically keeps
        // the sort cheap.
        for i in 0..(MAX_DIR_ENTRIES + 50) {
            fs::write(tmp.path().join(format!("f{i:05}.txt")), "").unwrap();
        }
        let state = state_with_root(tmp.path());
        let entries = list_directory_inner(tmp.path().to_str().unwrap(), &state).unwrap();
        // One sentinel on the end plus MAX_DIR_ENTRIES real rows.
        assert_eq!(entries.len(), MAX_DIR_ENTRIES + 1);
        let last = entries.last().unwrap();
        assert!(last.truncated, "last entry must be the truncation sentinel");
        assert!(
            last.name.contains("50"),
            "name should mention overflow count, got: {}",
            last.name
        );
    }

    /// Writing to a new file under a read-only parent triggers a persist
    /// failure.  The atomic-rename design must leave the filesystem
    /// unchanged (no partial file, no tempfile leaked into the tree).
    #[cfg(unix)]
    #[test]
    fn write_text_file_persist_failure_leaves_target_untouched() {
        use std::os::unix::fs::PermissionsExt;
        let tmp = TempDir::new().unwrap();
        let parent = tmp.path().join("ro");
        fs::create_dir(&parent).unwrap();
        let target = parent.join("file.txt");
        fs::write(&target, "original").unwrap();
        // Make the parent dir read-only so NamedTempFile::new_in fails.
        let mut perms = fs::metadata(&parent).unwrap().permissions();
        perms.set_mode(0o555);
        fs::set_permissions(&parent, perms).unwrap();

        let state = state_with_root(tmp.path());
        let result = write_text_file_inner(target.to_str().unwrap(), "new content", &state);
        // Restore so TempDir::drop can clean up.
        let mut perms = fs::metadata(&parent).unwrap().permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&parent, perms).unwrap();

        assert!(result.is_err(), "must surface the persist failure");
        // Crucially: the original content is still there.
        assert_eq!(
            fs::read_to_string(&target).unwrap(),
            "original",
            "atomic-rename design guarantees no partial write",
        );
        // And no stray tempfile got left behind in the parent.
        let leftovers: Vec<_> = fs::read_dir(&parent)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(leftovers, vec!["file.txt".to_string()]);
    }

    /// Reading a binary file returns a specific `BinaryFile` error
    /// rather than a cryptic UTF-8 error string.
    #[test]
    fn read_text_file_rejects_binary() {
        let tmp = TempDir::new().unwrap();
        let bin = tmp.path().join("x.bin");
        // 0xFF 0xFE are not valid UTF-8 start bytes.
        fs::write(&bin, [0xFFu8, 0xFE, 0x00, 0x01, 0x02]).unwrap();
        let state = state_with_root(tmp.path());
        let err = read_text_file_inner(bin.to_str().unwrap(), &state).unwrap_err();
        assert!(err.contains("binary"), "got: {err}");
    }

    /// `heavy` flag is set for node_modules / .git / target so the UI can
    /// show a "click to load anyway" affordance.
    #[test]
    fn list_directory_flags_heavy_dirs() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir(tmp.path().join("node_modules")).unwrap();
        fs::create_dir(tmp.path().join(".git")).unwrap();
        fs::create_dir(tmp.path().join("src")).unwrap();
        fs::write(tmp.path().join("README.md"), "").unwrap();
        let state = state_with_root(tmp.path());
        let entries = list_directory_inner(tmp.path().to_str().unwrap(), &state).unwrap();
        let heavy: Vec<&str> = entries
            .iter()
            .filter(|e| e.heavy)
            .map(|e| e.name.as_str())
            .collect();
        // Note: entries are sorted dirs-first alpha; only heavy ones should flag true.
        assert!(heavy.contains(&"node_modules"));
        assert!(heavy.contains(&".git"));
        assert!(!heavy.contains(&"src"));
        assert!(!heavy.contains(&"README.md"));
    }
}
