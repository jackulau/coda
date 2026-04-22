use crate::path_guard::resolve_safe;
use crate::AppState;
use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use tauri::State;

const MAX_RESULTS: usize = 500;

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub line: u32,
    pub column: u32,
    pub preview: String,
}

#[tauri::command]
pub async fn search_files(
    cwd: String,
    query: String,
    case_sensitive: Option<bool>,
    regex: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Vec<SearchHit>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let roots: Vec<PathBuf> = state
        .allowed_roots
        .lock()
        .map(|g| g.clone())
        .map_err(|_| "state lock poisoned".to_string())?;
    let safe = resolve_safe(std::path::Path::new(&cwd), &roots).map_err(|e| e.to_string())?;

    collect_search_hits(
        &safe,
        &query,
        case_sensitive.unwrap_or(false),
        regex.unwrap_or(false),
    )
}

pub fn collect_search_hits(
    cwd: &std::path::Path,
    query: &str,
    case_sensitive: bool,
    regex: bool,
) -> Result<Vec<SearchHit>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    // Always prefer git grep — it respects .gitignore and supports --column
    let is_git = cwd.join(".git").exists();
    let has_column;

    let output = if is_git {
        has_column = true;
        let mut args = vec!["grep".to_string(), "-n".to_string(), "--column".to_string()];
        if !case_sensitive {
            args.push("-i".to_string());
        }
        if !regex {
            args.push("-F".to_string());
        }
        args.push("--".to_string());
        args.push(query.to_string());
        Command::new("git")
            .args(&args)
            .current_dir(cwd)
            .output()
            .map_err(|e| format!("spawn git grep: {e}"))?
    } else {
        // macOS grep doesn't support --column or --exclude-dir reliably,
        // so we use a minimal portable invocation: -r -n only.
        has_column = false;
        let mut args = vec!["-r".to_string(), "-n".to_string()];
        if !case_sensitive {
            args.push("-i".to_string());
        }
        if !regex {
            args.push("-F".to_string());
        }
        args.push("--".to_string());
        args.push(query.to_string());
        args.push(".".to_string());
        Command::new("grep")
            .args(&args)
            .current_dir(cwd)
            .output()
            .map_err(|e| format!("spawn grep: {e}"))?
    };

    // grep returns exit code 1 for "no matches" — that's not an error
    if !output.status.success() && output.status.code() != Some(1) {
        return Err(format!(
            "search failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut hits = Vec::new();
    let strip = !is_git;
    for line in stdout.lines() {
        if hits.len() >= MAX_RESULTS {
            break;
        }
        let parsed = if has_column {
            parse_grep_line_with_column(line, strip)
        } else {
            parse_grep_line_no_column(line, strip)
        };
        if let Some(hit) = parsed {
            hits.push(hit);
        }
    }
    Ok(hits)
}

/// Parse `path:line:column:preview` (git grep --column format)
fn parse_grep_line_with_column(line: &str, strip_dot_slash: bool) -> Option<SearchHit> {
    let mut parts = line.splitn(4, ':');
    let mut path = parts.next()?.to_string();
    let line_no: u32 = parts.next()?.parse().ok()?;
    let col: u32 = parts.next()?.parse().ok()?;
    let preview = parts.next().unwrap_or("").to_string();

    if strip_dot_slash && path.starts_with("./") {
        path = path[2..].to_string();
    }

    Some(SearchHit {
        path,
        line: line_no,
        column: col,
        preview,
    })
}

/// Parse `path:line:preview` (plain grep -n format, no column)
fn parse_grep_line_no_column(line: &str, strip_dot_slash: bool) -> Option<SearchHit> {
    let mut parts = line.splitn(3, ':');
    let mut path = parts.next()?.to_string();
    let line_no: u32 = parts.next()?.parse().ok()?;
    let preview = parts.next().unwrap_or("").to_string();

    if strip_dot_slash && path.starts_with("./") {
        path = path[2..].to_string();
    }

    Some(SearchHit {
        path,
        line: line_no,
        column: 1,
        preview,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;

    #[test]
    fn parse_with_column_standard() {
        let hit = parse_grep_line_with_column("src/main.rs:42:5:fn main() {", false).unwrap();
        assert_eq!(hit.path, "src/main.rs");
        assert_eq!(hit.line, 42);
        assert_eq!(hit.column, 5);
        assert_eq!(hit.preview, "fn main() {");
    }

    #[test]
    fn parse_with_column_strips_dot_slash() {
        let hit = parse_grep_line_with_column("./src/lib.rs:10:1:use std;", true).unwrap();
        assert_eq!(hit.path, "src/lib.rs");
    }

    #[test]
    fn parse_with_column_colons_in_preview() {
        let hit = parse_grep_line_with_column("a.rs:1:3:let x: i32 = 0;", false).unwrap();
        assert_eq!(hit.preview, "let x: i32 = 0;");
    }

    #[test]
    fn parse_no_column_standard() {
        let hit = parse_grep_line_no_column("./src/main.rs:42:fn main() {", true).unwrap();
        assert_eq!(hit.path, "src/main.rs");
        assert_eq!(hit.line, 42);
        assert_eq!(hit.column, 1);
        assert_eq!(hit.preview, "fn main() {");
    }

    #[test]
    fn search_in_git_repo() {
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
        fs::write(dir.join("hello.txt"), "hello world\ngoodbye world\n").unwrap();
        run(&["add", "hello.txt"]);
        run(&["commit", "-m", "seed"]);

        let hits = collect_search_hits(dir, "hello", false, false).unwrap();
        assert!(!hits.is_empty());
        assert_eq!(hits[0].path, "hello.txt");
        assert_eq!(hits[0].line, 1);
    }

    #[test]
    fn search_empty_query() {
        let tmp = tempfile::tempdir().unwrap();
        let hits = collect_search_hits(tmp.path(), "", false, false).unwrap();
        assert!(hits.is_empty());
    }
}
