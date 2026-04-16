//! LSP server subprocess spawner.
//!
//! Design: the Tauri command `spawn_lsp_server(server_id, workspace_root)` resolves
//! a binary, launches it with `tokio::process::Command`, wires its stdin/stdout into
//! an internal channel registry, and returns a channel id. Frontend writes via
//! `lsp_write(channel, bytes)` and subscribes to Tauri events `lsp:<channel>:data`.
//!
//! The spawner separates three concerns so they are independently testable:
//!   - `resolve_server_binary`: locates the binary (CODA_LSP_DIR > PATH > bundled)
//!   - `ChannelRegistry`: tracks active channels, ids, stdin handles
//!   - `RateLimiter`: per-channel emission rate control to avoid flooding the webview
//!
//! The Tauri-facing commands (`spawn_lsp_server`, `lsp_write`, `kill_lsp_server`) sit
//! on top of these pieces. Unit tests exercise the pure logic without needing a real
//! Tauri runtime.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tokio::process::Child;

/// Environment variable that overrides the bundled LSP server binary directory.
pub const LSP_DIR_ENV: &str = "CODA_LSP_DIR";

/// Default SIGTERM -> SIGKILL grace period when killing a server.
pub const KILL_GRACE: Duration = Duration::from_secs(3);

/// Default rate-limit window for `lsp:<channel>:data` events.
pub const DEFAULT_RATE_WINDOW: Duration = Duration::from_millis(16);

#[derive(Debug, thiserror::Error)]
pub enum LspSpawnError {
    #[error("server id is empty")]
    EmptyServerId,
    #[error("unknown server id: {0}")]
    UnknownServer(String),
    #[error("server binary not found for: {0}")]
    BinaryNotFound(String),
    #[error("workspace root does not exist: {0}")]
    MissingWorkspace(String),
    #[error("channel not found: {0}")]
    ChannelNotFound(u64),
    #[error("io error: {0}")]
    Io(String),
}

impl From<std::io::Error> for LspSpawnError {
    fn from(e: std::io::Error) -> Self {
        LspSpawnError::Io(e.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnResult {
    pub channel: u64,
    pub pid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerSpec {
    pub id: String,
    /// Binary name, e.g. "typescript-language-server" or "rust-analyzer".
    pub binary: String,
    pub args: Vec<String>,
}

/// Resolve a server binary path. Lookup order:
///   1. `$CODA_LSP_DIR/<id>/<binary>` (dev escape hatch, per spec)
///   2. `$CODA_LSP_DIR/<binary>` (flat layout)
///   3. `which <binary>` (PATH)
///   4. bundled resources/lsp/<id>/<binary> (if `bundled_root` is Some)
///
/// Returns `Err(BinaryNotFound)` if none exists.
pub fn resolve_server_binary(
    spec: &LspServerSpec,
    coda_lsp_dir: Option<&str>,
    bundled_root: Option<&PathBuf>,
) -> Result<PathBuf, LspSpawnError> {
    if spec.id.is_empty() {
        return Err(LspSpawnError::EmptyServerId);
    }
    let exe = if cfg!(windows) && !spec.binary.ends_with(".exe") {
        format!("{}.exe", spec.binary)
    } else {
        spec.binary.clone()
    };

    if let Some(dir) = coda_lsp_dir {
        let nested = PathBuf::from(dir).join(&spec.id).join(&exe);
        if nested.exists() {
            return Ok(nested);
        }
        let flat = PathBuf::from(dir).join(&exe);
        if flat.exists() {
            return Ok(flat);
        }
    }

    if let Some(on_path) = which_on_path(&exe) {
        return Ok(on_path);
    }

    if let Some(root) = bundled_root {
        let candidate = root.join(&spec.id).join(&exe);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(LspSpawnError::BinaryNotFound(spec.id.clone()))
}

fn which_on_path(exe: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(exe);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

/// A simple per-channel token-bucket rate limiter. We only care about *frequency*
/// of events, not byte throughput — a burst of many small JSON-RPC messages during
/// a big file open must not lock the webview.
///
/// `try_emit` returns true if the emission is allowed now, false if it should be
/// coalesced/dropped. Callers may batch pending bytes into the next allowed window.
#[derive(Debug)]
pub struct RateLimiter {
    window: Duration,
    last: Mutex<Option<Instant>>,
}

impl RateLimiter {
    pub fn new(window: Duration) -> Self {
        Self {
            window,
            last: Mutex::new(None),
        }
    }

    pub fn try_emit(&self) -> bool {
        self.try_emit_at(Instant::now())
    }

    pub fn try_emit_at(&self, now: Instant) -> bool {
        let mut g = self.last.lock().expect("rate limiter lock");
        match *g {
            Some(prev) if now.duration_since(prev) < self.window => false,
            _ => {
                *g = Some(now);
                true
            }
        }
    }
}

/// Represents one spawned LSP server. We keep the child process so we can kill it,
/// and a stdin sink so frontend writes can be piped in.
pub struct LspChannel {
    pub id: u64,
    pub server_id: String,
    pub child: Option<Child>,
    pub rate: RateLimiter,
}

#[derive(Default)]
pub struct ChannelRegistry {
    next_id: AtomicU64,
    channels: Mutex<HashMap<u64, Arc<Mutex<LspChannel>>>>,
}

impl ChannelRegistry {
    pub fn new() -> Self {
        Self {
            next_id: AtomicU64::new(1),
            channels: Mutex::new(HashMap::new()),
        }
    }

    pub fn allocate(&self, server_id: impl Into<String>) -> u64 {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let channel = LspChannel {
            id,
            server_id: server_id.into(),
            child: None,
            rate: RateLimiter::new(DEFAULT_RATE_WINDOW),
        };
        self.channels
            .lock()
            .expect("registry lock")
            .insert(id, Arc::new(Mutex::new(channel)));
        id
    }

    pub fn attach_child(&self, id: u64, child: Child) -> Result<(), LspSpawnError> {
        let map = self.channels.lock().expect("registry lock");
        let ch = map.get(&id).ok_or(LspSpawnError::ChannelNotFound(id))?;
        ch.lock().expect("channel lock").child = Some(child);
        Ok(())
    }

    pub fn get(&self, id: u64) -> Option<Arc<Mutex<LspChannel>>> {
        self.channels
            .lock()
            .expect("registry lock")
            .get(&id)
            .cloned()
    }

    pub fn remove(&self, id: u64) -> Option<Arc<Mutex<LspChannel>>> {
        self.channels.lock().expect("registry lock").remove(&id)
    }

    pub fn active_count(&self) -> usize {
        self.channels.lock().expect("registry lock").len()
    }
}

/// Send SIGTERM on Unix, TerminateProcess on Windows (best-effort).
/// On Windows there is no true SIGTERM equivalent, so the graceful phase falls
/// through to `kill` directly.
fn send_graceful_signal(child: &Child) {
    #[cfg(unix)]
    {
        if let Some(pid) = child.id() {
            // SAFETY: calling libc::kill with a pid we own is safe; the return
            // code is best-effort — the child may have already exited.
            unsafe {
                libc::kill(pid as i32, libc::SIGTERM);
            }
        }
    }
    #[cfg(not(unix))]
    {
        // Windows path: start_kill uses TerminateProcess (ungraceful). We skip
        // the "graceful" phase on Windows and the caller's grace loop will
        // simply observe exit quickly.
        let _ = child;
    }
}

/// Kill a child process gracefully: send SIGTERM on Unix, wait up to `grace`,
/// then SIGKILL if still alive. Returns `true` if the child exited before the
/// grace period expired (clean shutdown), `false` if SIGKILL was required.
pub async fn kill_with_grace(child: &mut Child, grace: Duration) -> bool {
    if child.try_wait().ok().flatten().is_some() {
        return true;
    }

    send_graceful_signal(child);

    let deadline = Instant::now() + grace;
    loop {
        if child.try_wait().ok().flatten().is_some() {
            return true;
        }
        if Instant::now() >= deadline {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }

    // Escalate: SIGKILL (Unix) or TerminateProcess (Windows).
    let _ = child.kill().await;
    false
}

/// Build the `tokio::process::Command` for an LSP server launch. Separated from the
/// `spawn` call so tests can assert on the command shape without actually forking.
pub fn build_command(
    binary: &PathBuf,
    args: &[String],
    workspace_root: &PathBuf,
) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(binary);
    cmd.args(args)
        .current_dir(workspace_root)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    cmd
}

/// Resolve a spec → spawn the process → register a channel → return PID+channel.
///
/// This is the bridge the Tauri `#[command] fn spawn_lsp_server(...)` calls into.
/// The Tauri command itself is thin; the real logic sits here so it's testable
/// without a Tauri `AppHandle`.
pub async fn spawn_lsp_server(
    spec: &LspServerSpec,
    workspace_root: &PathBuf,
    registry: &ChannelRegistry,
    coda_lsp_dir: Option<&str>,
    bundled_root: Option<&PathBuf>,
) -> Result<SpawnResult, LspSpawnError> {
    if !workspace_root.exists() {
        return Err(LspSpawnError::MissingWorkspace(
            workspace_root.display().to_string(),
        ));
    }
    let binary = resolve_server_binary(spec, coda_lsp_dir, bundled_root)?;
    let mut cmd = build_command(&binary, &spec.args, workspace_root);
    let child = cmd.spawn()?;
    let pid = child.id().ok_or_else(|| {
        LspSpawnError::Io("spawned child has no pid (already exited?)".into())
    })?;
    let channel = registry.allocate(&spec.id);
    registry.attach_child(channel, child)?;
    Ok(SpawnResult { channel, pid })
}

/// Kill an LSP server by channel id. Looks up the registry, removes the entry,
/// and gracefully terminates the child.
pub async fn kill_lsp_server(
    registry: &ChannelRegistry,
    channel: u64,
    grace: Duration,
) -> Result<bool, LspSpawnError> {
    let entry = registry
        .remove(channel)
        .ok_or(LspSpawnError::ChannelNotFound(channel))?;
    let mut guard = entry.lock().expect("channel lock");
    if let Some(child) = guard.child.as_mut() {
        Ok(kill_with_grace(child, grace).await)
    } else {
        Ok(true)
    }
}

#[cfg(test)]
mod lsp_spawn_inline_tests {
    use super::*;
    use std::fs;

    #[test]
    fn resolve_empty_id_errors() {
        let spec = LspServerSpec {
            id: String::new(),
            binary: "foo".into(),
            args: vec![],
        };
        let err = resolve_server_binary(&spec, None, None).unwrap_err();
        assert!(matches!(err, LspSpawnError::EmptyServerId));
    }

    #[test]
    fn resolve_prefers_coda_lsp_dir_nested_layout() {
        let dir = tempdir();
        let nested = dir.join("typescript");
        fs::create_dir_all(&nested).unwrap();
        let bin = nested.join("tss");
        fs::write(&bin, b"#!/bin/sh\n").unwrap();
        let spec = LspServerSpec {
            id: "typescript".into(),
            binary: "tss".into(),
            args: vec![],
        };
        let got = resolve_server_binary(&spec, Some(dir.to_str().unwrap()), None).unwrap();
        assert_eq!(got, bin);
    }

    #[test]
    fn resolve_accepts_flat_coda_lsp_dir_layout() {
        let dir = tempdir();
        let bin = dir.join("tss2");
        fs::write(&bin, b"#!/bin/sh\n").unwrap();
        let spec = LspServerSpec {
            id: "typescript".into(),
            binary: "tss2".into(),
            args: vec![],
        };
        let got = resolve_server_binary(&spec, Some(dir.to_str().unwrap()), None).unwrap();
        assert_eq!(got, bin);
    }

    #[test]
    fn resolve_falls_back_to_bundled_root() {
        let dir = tempdir();
        let bundled = dir.join("python");
        fs::create_dir_all(&bundled).unwrap();
        let bin = bundled.join("pyls");
        fs::write(&bin, b"#!/bin/sh\n").unwrap();
        let spec = LspServerSpec {
            id: "python".into(),
            binary: "pyls".into(),
            args: vec![],
        };
        let got =
            resolve_server_binary(&spec, None, Some(&dir)).expect("resolves via bundled_root");
        assert_eq!(got, bin);
    }

    #[test]
    fn resolve_returns_binary_not_found_when_missing() {
        let spec = LspServerSpec {
            id: "nonesuch".into(),
            binary: "definitely-not-real-binary-xyz".into(),
            args: vec![],
        };
        let err = resolve_server_binary(&spec, None, None).unwrap_err();
        assert!(matches!(err, LspSpawnError::BinaryNotFound(_)));
    }

    #[test]
    fn rate_limiter_allows_first_emit_denies_burst() {
        let rl = RateLimiter::new(Duration::from_millis(100));
        let t0 = Instant::now();
        assert!(rl.try_emit_at(t0));
        assert!(!rl.try_emit_at(t0 + Duration::from_millis(10)));
        assert!(!rl.try_emit_at(t0 + Duration::from_millis(99)));
        assert!(rl.try_emit_at(t0 + Duration::from_millis(101)));
    }

    #[test]
    fn channel_registry_allocates_unique_ids() {
        let r = ChannelRegistry::new();
        let a = r.allocate("typescript");
        let b = r.allocate("typescript");
        let c = r.allocate("python");
        assert_ne!(a, b);
        assert_ne!(b, c);
        assert_eq!(r.active_count(), 3);
    }

    #[test]
    fn channel_registry_remove_drops_entry() {
        let r = ChannelRegistry::new();
        let a = r.allocate("typescript");
        assert!(r.get(a).is_some());
        assert!(r.remove(a).is_some());
        assert!(r.get(a).is_none());
        assert_eq!(r.active_count(), 0);
    }

    #[test]
    fn channel_registry_attach_child_rejects_unknown() {
        let r = ChannelRegistry::new();
        // Allocate one real id but use an unknown one for the assertion.
        let _ = r.allocate("typescript");
        // We can't easily build a `Child` without spawning, so we test the error
        // path via a spawned `sh -c exit 0` which is portable.
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let mut cmd = tokio::process::Command::new("sh");
            cmd.arg("-c").arg("exit 0").kill_on_drop(true);
            if let Ok(child) = cmd.spawn() {
                let err = r.attach_child(9999, child).unwrap_err();
                assert!(matches!(err, LspSpawnError::ChannelNotFound(9999)));
            }
        });
    }

    #[test]
    fn build_command_applies_workspace_and_piped_stdio() {
        let bin = PathBuf::from("/bin/echo");
        let wsroot = PathBuf::from("/tmp");
        let cmd = build_command(&bin, &["hello".into(), "world".into()], &wsroot);
        let std_cmd = cmd.as_std();
        assert_eq!(std_cmd.get_program(), "/bin/echo");
        let args: Vec<_> = std_cmd.get_args().collect();
        assert_eq!(args, &["hello", "world"]);
        assert_eq!(std_cmd.get_current_dir().map(|p| p.to_path_buf()), Some(wsroot));
    }

    #[tokio::test]
    async fn kill_with_grace_returns_true_when_already_exited() {
        let mut cmd = tokio::process::Command::new("sh");
        cmd.arg("-c").arg("exit 0").kill_on_drop(true);
        let mut child = cmd.spawn().expect("spawn sh");
        // Wait for it to exit so try_wait sees it.
        let _ = child.wait().await;
        let graceful = kill_with_grace(&mut child, Duration::from_millis(100)).await;
        assert!(graceful, "already-exited child counts as graceful");
    }

    #[tokio::test]
    async fn kill_with_grace_sigterms_sleeper() {
        // A child that explicitly traps SIGTERM and loops so shells that "exec
        // the last command" (bash -c optimization) can't drop the trap.
        let script = "trap 'true' TERM; while :; do sleep 1; done";
        let mut cmd = tokio::process::Command::new("sh");
        cmd.arg("-c").arg(script).kill_on_drop(true);
        let mut child = cmd.spawn().expect("spawn sh");
        let pid = child.id().expect("pid");
        // Give the shell a moment to install its trap handler before we signal.
        tokio::time::sleep(Duration::from_millis(100)).await;
        eprintln!("child pid={} — sending test kill_with_grace", pid);
        let graceful = kill_with_grace(&mut child, Duration::from_millis(300)).await;
        // The child ignores SIGTERM so we must escalate to SIGKILL: graceful=false
        assert!(!graceful, "sigterm-ignoring child should require SIGKILL");
        // After the return, the child must be reaped — try_wait returns Some.
        assert!(child.try_wait().expect("try_wait").is_some());
    }

    #[tokio::test]
    async fn kill_with_grace_allows_graceful_shutdown() {
        // A child that cleanly exits on SIGTERM should graceful=true without kill.
        let script = "trap 'exit 0' TERM; while :; do sleep 1; done";
        let mut cmd = tokio::process::Command::new("sh");
        cmd.arg("-c").arg(script).kill_on_drop(true);
        let mut child = cmd.spawn().expect("spawn sh");
        let graceful = kill_with_grace(&mut child, Duration::from_millis(500)).await;
        assert!(graceful, "child that exits on SIGTERM counts as graceful");
    }

    #[test]
    fn lsp_dir_env_constant_matches_spec() {
        assert_eq!(LSP_DIR_ENV, "CODA_LSP_DIR");
    }

    fn tempdir() -> PathBuf {
        let base = std::env::temp_dir();
        let unique = format!(
            "coda-lsp-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        );
        let p = base.join(unique);
        std::fs::create_dir_all(&p).unwrap();
        p
    }
}
