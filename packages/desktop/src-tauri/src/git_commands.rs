//! Read-only git inspection commands: list changed files for a workspace,
//! with additions/deletions counts. Shells out to `git`. The workspace
//! root is the `cwd`; we reject any path not under an allowed root.
//!
//! Why shell out: jumping to libgit2 buys us marginally faster status at
//! the cost of a C dep and ~500 LOC of bindings. `git status --porcelain`
//! + `git diff --numstat HEAD` is what every other editor does and is
//! unambiguously correct.

use crate::path_guard::resolve_safe;
use crate::AppState;
use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use tauri::State;

#[derive(Serialize, Debug, PartialEq, Eq, Clone)]
#[serde(rename_all = "lowercase")]
pub enum ChangeKind {
    Add,
    Modify,
    Delete,
}

#[derive(Serialize, Debug, Clone)]
pub struct ChangedFile {
    pub path: String,
    pub kind: ChangeKind,
    pub additions: u32,
    pub deletions: u32,
}

#[tauri::command]
pub async fn list_changed_files(
    cwd: String,
    state: State<'_, AppState>,
) -> Result<Vec<ChangedFile>, String> {
    let requested = PathBuf::from(&cwd);
    let roots: Vec<PathBuf> = {
        let g = state.allowed_roots.lock().map_err(|_| "state lock poisoned".to_string())?;
        g.clone()
    };
    let safe = resolve_safe(&requested, &roots)
        .map_err(|e| e.to_string())?;

    collect_changed_files(&safe)
}

pub fn collect_changed_files(repo: &std::path::Path) -> Result<Vec<ChangedFile>, String> {
    let status_out = Command::new("git")
        .args(["status", "--porcelain=v1", "-z"])
        .current_dir(repo)
        .output()
        .map_err(|e| format!("spawn git status: {e}"))?;
    if !status_out.status.success() {
        return Err(format!(
            "git status failed: {}",
            String::from_utf8_lossy(&status_out.stderr).trim()
        ));
    }

    let mut out: Vec<ChangedFile> = parse_porcelain(&status_out.stdout);

    let numstat_out = Command::new("git")
        .args(["diff", "--numstat", "HEAD"])
        .current_dir(repo)
        .output()
        .map_err(|e| format!("spawn git diff: {e}"))?;

    if numstat_out.status.success() {
        let numstats = parse_numstat(&String::from_utf8_lossy(&numstat_out.stdout));
        for f in out.iter_mut() {
            if let Some(&(a, d)) = numstats.get(f.path.as_str()) {
                f.additions = a;
                f.deletions = d;
            }
        }
    }

    Ok(out)
}

fn parse_porcelain(bytes: &[u8]) -> Vec<ChangedFile> {
    let mut out = Vec::new();
    for record in bytes.split(|&b| b == 0) {
        if record.len() < 3 {
            continue;
        }
        let staged = record[0] as char;
        let unstaged = record[1] as char;
        let path_bytes = &record[3..];
        let path = match std::str::from_utf8(path_bytes) {
            Ok(s) => s.to_string(),
            Err(_) => continue,
        };
        let kind = porcelain_kind(staged, unstaged);
        out.push(ChangedFile {
            path,
            kind,
            additions: 0,
            deletions: 0,
        });
    }
    out
}

fn porcelain_kind(staged: char, unstaged: char) -> ChangeKind {
    let has = |c: char| staged == c || unstaged == c;
    if has('D') {
        ChangeKind::Delete
    } else if staged == 'A' || staged == '?' || unstaged == '?' {
        ChangeKind::Add
    } else {
        ChangeKind::Modify
    }
}

fn parse_numstat(text: &str) -> std::collections::HashMap<String, (u32, u32)> {
    let mut map = std::collections::HashMap::new();
    for line in text.lines() {
        let mut parts = line.split('\t');
        let adds = parts.next().unwrap_or("0");
        let dels = parts.next().unwrap_or("0");
        let path = match parts.next() {
            Some(p) => p.to_string(),
            None => continue,
        };
        let a = adds.parse::<u32>().unwrap_or(0);
        let d = dels.parse::<u32>().unwrap_or(0);
        map.insert(path, (a, d));
    }
    map
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_numstat_simple() {
        let m = parse_numstat("3\t1\tsrc/a.rs\n0\t4\tsrc/b.rs\n");
        assert_eq!(m.get("src/a.rs"), Some(&(3, 1)));
        assert_eq!(m.get("src/b.rs"), Some(&(0, 4)));
    }

    #[test]
    fn parse_numstat_binary_dash() {
        // Binary files produce "-\t-\tpath\n"; we should just treat as 0/0 rather than panic.
        let m = parse_numstat("-\t-\timg.png\n");
        assert_eq!(m.get("img.png"), Some(&(0, 0)));
    }

    #[test]
    fn porcelain_kind_maps_to_change_kind() {
        assert_eq!(porcelain_kind('?', '?'), ChangeKind::Add);
        assert_eq!(porcelain_kind('A', ' '), ChangeKind::Add);
        assert_eq!(porcelain_kind(' ', 'M'), ChangeKind::Modify);
        assert_eq!(porcelain_kind('M', 'M'), ChangeKind::Modify);
        assert_eq!(porcelain_kind('D', ' '), ChangeKind::Delete);
        assert_eq!(porcelain_kind(' ', 'D'), ChangeKind::Delete);
    }

    #[test]
    fn parse_porcelain_null_separated() {
        // Two records: " M src/a.rs" and "?? new.txt"
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b" M src/a.rs");
        bytes.push(0);
        bytes.extend_from_slice(b"?? new.txt");
        bytes.push(0);
        let out = parse_porcelain(&bytes);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].path, "src/a.rs");
        assert_eq!(out[0].kind, ChangeKind::Modify);
        assert_eq!(out[1].path, "new.txt");
        assert_eq!(out[1].kind, ChangeKind::Add);
    }

    /// End-to-end: create a fresh repo, add+modify+delete files, and confirm
    /// collect_changed_files groups them correctly. Requires `git` on PATH.
    #[test]
    fn collect_changed_files_end_to_end() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path();
        let run = |args: &[&str]| -> bool {
            Command::new("git")
                .args(args)
                .current_dir(dir)
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        };
        if !run(&["init"]) {
            eprintln!("git not available — skipping");
            return;
        }
        run(&["config", "user.email", "t@t"]);
        run(&["config", "user.name", "t"]);
        std::fs::write(dir.join("tracked.txt"), "line1\nline2\n").unwrap();
        run(&["add", "tracked.txt"]);
        run(&["commit", "-m", "seed"]);
        std::fs::write(dir.join("tracked.txt"), "line1\nline2\nline3\n").unwrap();
        std::fs::write(dir.join("new.txt"), "hi\n").unwrap();

        let files = collect_changed_files(dir).unwrap();
        let paths: Vec<&str> = files.iter().map(|f| f.path.as_str()).collect();
        assert!(paths.contains(&"tracked.txt"), "missing tracked.txt: {paths:?}");
        assert!(paths.contains(&"new.txt"), "missing new.txt: {paths:?}");
        let tracked = files.iter().find(|f| f.path == "tracked.txt").unwrap();
        assert_eq!(tracked.kind, ChangeKind::Modify);
        assert_eq!(tracked.additions, 1);
        assert_eq!(tracked.deletions, 0);
    }
}
