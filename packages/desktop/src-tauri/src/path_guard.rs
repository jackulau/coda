//! Path-guard: canonicalizes a requested path and rejects anything not
//! under one of the registered allowed roots. This is the single choke
//! point for every filesystem command that accepts a user-supplied path.
//!
//! Why canonicalize: `Path::starts_with` is purely textual and is fooled
//! by `..` and symlinks. `fs::canonicalize` resolves both, so comparing
//! canonical forms closes the escape.

use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum FsError {
    #[error("path is not allowed: {0}")]
    NotAllowed(String),
    #[error("path does not exist: {0}")]
    NotFound(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("file is too large ({size} bytes; max {max})")]
    FileTooLarge { size: u64, max: u64 },
    #[error("invalid utf-8 in path")]
    InvalidUtf8,
}

impl From<FsError> for String {
    fn from(e: FsError) -> String {
        e.to_string()
    }
}

/// Canonicalize `requested` and assert it lives under at least one of
/// `allowed_roots` (also canonicalized). Returns the canonical path on
/// success.
pub fn resolve_safe(requested: &Path, allowed_roots: &[PathBuf]) -> Result<PathBuf, FsError> {
    if allowed_roots.is_empty() {
        return Err(FsError::NotAllowed(requested.display().to_string()));
    }
    let target = std::fs::canonicalize(requested).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => FsError::NotFound(requested.display().to_string()),
        _ => FsError::Io(e),
    })?;
    for root in allowed_roots {
        let canon_root = match std::fs::canonicalize(root) {
            Ok(p) => p,
            Err(_) => continue,
        };
        if target.starts_with(&canon_root) {
            return Ok(target);
        }
    }
    Err(FsError::NotAllowed(requested.display().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn resolve_safe_accepts_subpath() {
        let dir = TempDir::new().unwrap();
        let root = dir.path().to_path_buf();
        let sub = root.join("a").join("b.txt");
        fs::create_dir_all(sub.parent().unwrap()).unwrap();
        fs::write(&sub, "hi").unwrap();

        let out = resolve_safe(&sub, std::slice::from_ref(&root)).unwrap();
        let canon_root = fs::canonicalize(&root).unwrap();
        assert!(out.starts_with(&canon_root));
    }

    #[test]
    fn resolve_safe_rejects_dotdot_escape() {
        let dir = TempDir::new().unwrap();
        let root = dir.path().join("root");
        fs::create_dir_all(&root).unwrap();
        let outside = dir.path().join("outside.txt");
        fs::write(&outside, "no").unwrap();

        // textual escape via ..
        let probe = root.join("..").join("outside.txt");
        let err = resolve_safe(&probe, std::slice::from_ref(&root)).unwrap_err();
        matches!(err, FsError::NotAllowed(_));
    }

    #[cfg(unix)]
    #[test]
    fn resolve_safe_rejects_symlink_escape() {
        let dir = TempDir::new().unwrap();
        let root = dir.path().join("root");
        fs::create_dir_all(&root).unwrap();
        let outside = dir.path().join("secrets.txt");
        fs::write(&outside, "top secret").unwrap();

        // symlink INSIDE root pointing OUTSIDE root
        let link = root.join("escape");
        std::os::unix::fs::symlink(&outside, &link).unwrap();

        let err = resolve_safe(&link, std::slice::from_ref(&root)).unwrap_err();
        assert!(
            matches!(err, FsError::NotAllowed(_)),
            "expected NotAllowed, got {err:?}"
        );
    }

    #[test]
    fn resolve_safe_rejects_nonexistent_path() {
        let dir = TempDir::new().unwrap();
        let err =
            resolve_safe(&dir.path().join("missing"), &[dir.path().to_path_buf()]).unwrap_err();
        assert!(matches!(err, FsError::NotFound(_)));
    }

    #[test]
    fn resolve_safe_empty_roots_rejects() {
        let dir = TempDir::new().unwrap();
        let err = resolve_safe(dir.path(), &[]).unwrap_err();
        assert!(matches!(err, FsError::NotAllowed(_)));
    }

    #[test]
    fn resolve_safe_accepts_symlink_pointing_inside_root() {
        let dir = TempDir::new().unwrap();
        let root = dir.path().join("root");
        fs::create_dir_all(&root).unwrap();
        let target = root.join("real.txt");
        fs::write(&target, "hi").unwrap();
        #[cfg(unix)]
        {
            let link = root.join("link");
            std::os::unix::fs::symlink(&target, &link).unwrap();
            let out = resolve_safe(&link, std::slice::from_ref(&root)).unwrap();
            let canon_root = fs::canonicalize(&root).unwrap();
            assert!(out.starts_with(&canon_root));
        }
    }
}
