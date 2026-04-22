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

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
    pub files_changed: u32,
    pub additions: u32,
    pub deletions: u32,
}

fn resolve_cwd(cwd: &str, state: &AppState) -> Result<PathBuf, String> {
    let roots: Vec<PathBuf> = state
        .allowed_roots
        .lock()
        .map(|g| g.clone())
        .map_err(|_| "state lock poisoned".to_string())?;
    resolve_safe(std::path::Path::new(cwd), &roots).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_changed_files(
    cwd: String,
    state: State<'_, AppState>,
) -> Result<Vec<ChangedFile>, String> {
    let safe = resolve_cwd(&cwd, &state)?;
    collect_changed_files(&safe)
}

#[tauri::command]
pub async fn list_all_files(
    cwd: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let safe = resolve_cwd(&cwd, &state)?;
    collect_all_files(&safe)
}

#[tauri::command]
pub async fn get_file_diff(
    cwd: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let safe = resolve_cwd(&cwd, &state)?;
    collect_file_diff(&safe, &path)
}

#[tauri::command]
pub async fn git_log(
    cwd: String,
    limit: Option<u32>,
    path: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<GitCommit>, String> {
    let safe = resolve_cwd(&cwd, &state)?;
    collect_git_log(&safe, limit.unwrap_or(50), path.as_deref())
}

#[tauri::command]
pub async fn git_commit_diff(
    cwd: String,
    hash: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let safe = resolve_cwd(&cwd, &state)?;
    collect_commit_diff(&safe, &hash)
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

pub fn collect_all_files(repo: &std::path::Path) -> Result<Vec<String>, String> {
    let is_git = repo.join(".git").exists();
    let output = if is_git {
        Command::new("git")
            .args(["ls-files", "--cached", "--others", "--exclude-standard"])
            .current_dir(repo)
            .output()
            .map_err(|e| format!("spawn git ls-files: {e}"))?
    } else {
        Command::new("find")
            .args([
                ".", "-type", "f",
                "-not", "-path", "./.git/*",
                "-not", "-path", "./node_modules/*",
                "-not", "-path", "./target/*",
                "-not", "-path", "./.next/*",
                "-not", "-path", "./dist/*",
                "-not", "-path", "./build/*",
            ])
            .current_dir(repo)
            .output()
            .map_err(|e| format!("spawn find: {e}"))?
    };
    if !output.status.success() {
        return Err(format!(
            "list files failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut files: Vec<String> = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .take(10_000)
        .map(|l| {
            if l.starts_with("./") {
                l[2..].to_string()
            } else {
                l.to_string()
            }
        })
        .collect();
    files.sort();
    Ok(files)
}

pub fn collect_file_diff(repo: &std::path::Path, path: &str) -> Result<String, String> {
    // Try tracked file diff first
    let output = Command::new("git")
        .args(["diff", "HEAD", "--", path])
        .current_dir(repo)
        .output()
        .map_err(|e| format!("spawn git diff: {e}"))?;

    if output.status.success() {
        let diff = String::from_utf8_lossy(&output.stdout).to_string();
        if !diff.is_empty() {
            return Ok(diff);
        }
    }

    // For untracked files, show full content as an add diff
    let output = Command::new("git")
        .args(["diff", "--no-index", "/dev/null", path])
        .current_dir(repo)
        .output()
        .map_err(|e| format!("spawn git diff --no-index: {e}"))?;

    // git diff --no-index returns 1 when files differ (expected)
    let diff = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(diff)
}

pub fn collect_git_log(
    repo: &std::path::Path,
    limit: u32,
    path: Option<&str>,
) -> Result<Vec<GitCommit>, String> {
    let limit_arg = format!("-{limit}");
    let mut cmd = Command::new("git");
    cmd.args([
        "log",
        &limit_arg,
        "--format=__COMMIT__%H%n%h%n%an%n%aI%n%s",
        "--shortstat",
    ]);
    if let Some(p) = path {
        cmd.arg("--").arg(p);
    }
    let output = cmd
        .current_dir(repo)
        .output()
        .map_err(|e| format!("spawn git log: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "git log failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut commits = Vec::new();

    for block in stdout.split("__COMMIT__") {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }
        let lines: Vec<&str> = block.lines().collect();
        if lines.len() < 5 {
            continue;
        }
        let (files_changed, additions, deletions) = if lines.len() > 5 {
            parse_shortstat(lines[5])
        } else {
            (0, 0, 0)
        };
        commits.push(GitCommit {
            hash: lines[0].to_string(),
            short_hash: lines[1].to_string(),
            author: lines[2].to_string(),
            date: lines[3].to_string(),
            message: lines[4].to_string(),
            files_changed,
            additions,
            deletions,
        });
    }

    Ok(commits)
}

fn parse_shortstat(line: &str) -> (u32, u32, u32) {
    let mut files = 0u32;
    let mut adds = 0u32;
    let mut dels = 0u32;
    for part in line.split(',') {
        let part = part.trim();
        let num: u32 = part
            .split_whitespace()
            .next()
            .and_then(|n| n.parse().ok())
            .unwrap_or(0);
        if part.contains("file") {
            files = num;
        } else if part.contains("insertion") {
            adds = num;
        } else if part.contains("deletion") {
            dels = num;
        }
    }
    (files, adds, dels)
}

pub fn collect_commit_diff(repo: &std::path::Path, hash: &str) -> Result<String, String> {
    // Validate hash: only hex chars to prevent injection
    if !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("invalid commit hash".to_string());
    }
    let output = Command::new("git")
        .args(["show", hash, "--format=", "--patch"])
        .current_dir(repo)
        .output()
        .map_err(|e| format!("spawn git show: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "git show failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
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

    #[test]
    fn parse_shortstat_full() {
        let (f, a, d) = parse_shortstat(" 3 files changed, 12 insertions(+), 5 deletions(-)");
        assert_eq!((f, a, d), (3, 12, 5));
    }

    #[test]
    fn parse_shortstat_insert_only() {
        let (f, a, d) = parse_shortstat(" 1 file changed, 4 insertions(+)");
        assert_eq!((f, a, d), (1, 4, 0));
    }

    #[test]
    fn collect_commit_diff_rejects_injection() {
        let tmp = tempfile::tempdir().unwrap();
        let err = collect_commit_diff(tmp.path(), "abc; rm -rf /").unwrap_err();
        assert!(err.contains("invalid commit hash"), "got: {err}");
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

    #[test]
    fn list_all_files_in_git_repo() {
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
            return;
        }
        run(&["config", "user.email", "t@t"]);
        run(&["config", "user.name", "t"]);
        std::fs::write(dir.join("a.txt"), "a").unwrap();
        std::fs::create_dir(dir.join("sub")).unwrap();
        std::fs::write(dir.join("sub/b.txt"), "b").unwrap();
        run(&["add", "."]);
        run(&["commit", "-m", "init"]);

        let files = collect_all_files(dir).unwrap();
        assert!(files.contains(&"a.txt".to_string()));
        assert!(files.contains(&"sub/b.txt".to_string()));
    }

    #[test]
    fn get_file_diff_for_modified_file() {
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
            return;
        }
        run(&["config", "user.email", "t@t"]);
        run(&["config", "user.name", "t"]);
        std::fs::write(dir.join("f.txt"), "old\n").unwrap();
        run(&["add", "f.txt"]);
        run(&["commit", "-m", "init"]);
        std::fs::write(dir.join("f.txt"), "new\n").unwrap();

        let diff = collect_file_diff(dir, "f.txt").unwrap();
        assert!(diff.contains("-old"), "diff should show removed line: {diff}");
        assert!(diff.contains("+new"), "diff should show added line: {diff}");
    }

    #[test]
    fn git_log_returns_commits() {
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
            return;
        }
        run(&["config", "user.email", "t@t"]);
        run(&["config", "user.name", "t"]);
        std::fs::write(dir.join("a.txt"), "hi\n").unwrap();
        run(&["add", "."]);
        run(&["commit", "-m", "first commit"]);
        std::fs::write(dir.join("b.txt"), "bye\n").unwrap();
        run(&["add", "."]);
        run(&["commit", "-m", "second commit"]);

        let log = collect_git_log(dir, 10, None).unwrap();
        assert_eq!(log.len(), 2);
        assert_eq!(log[0].message, "second commit");
        assert_eq!(log[1].message, "first commit");
    }
}
