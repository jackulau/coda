//! Extra tests for `lsp_spawn`, exposing the spec-level filter `lsp_spawn`.
//!
//! Run with: `cargo test --manifest-path packages/desktop/src-tauri/Cargo.toml lsp_spawn`
//!
//! These tests focus on integration-flavored behavior that's harder to express
//! inline: a resolve→build_command→spawn→kill round trip, and verification
//! that backpressure actually coalesces bursts.

use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use crate::lsp_spawn::{
    build_command, kill_with_grace, resolve_server_binary, ChannelRegistry, LspServerSpec,
    RateLimiter, KILL_GRACE, LSP_DIR_ENV,
};

#[test]
fn lsp_spawn_constants_match_spec() {
    assert_eq!(LSP_DIR_ENV, "CODA_LSP_DIR", "spec pins env var name");
    assert_eq!(KILL_GRACE, Duration::from_secs(3), "spec pins SIGTERM grace");
}

#[test]
fn lsp_spawn_resolve_roundtrips_executable_in_coda_lsp_dir() {
    let root = tempdir("resolve-roundtrip");
    let sub = root.join("typescript");
    fs::create_dir_all(&sub).unwrap();
    let exe = sub.join("tsserver");
    fs::write(&exe, b"#!/bin/sh\n").unwrap();
    let spec = LspServerSpec {
        id: "typescript".into(),
        binary: "tsserver".into(),
        args: vec![],
    };
    let got = resolve_server_binary(&spec, Some(root.to_str().unwrap()), None).unwrap();
    assert_eq!(got, exe);
}

#[test]
fn lsp_spawn_rate_limiter_coalesces_bursts() {
    let rl = RateLimiter::new(Duration::from_millis(50));
    let t0 = Instant::now();
    let mut allowed = 0;
    for i in 0..10 {
        if rl.try_emit_at(t0 + Duration::from_millis(i * 5)) {
            allowed += 1;
        }
    }
    // 10 emit attempts over 50ms with a 50ms window → only the first is allowed.
    assert_eq!(allowed, 1, "backpressure coalesced burst to a single emit");
}

#[test]
fn lsp_spawn_channel_registry_allocates_and_removes() {
    let r = ChannelRegistry::new();
    let a = r.allocate("typescript");
    let b = r.allocate("python");
    assert_ne!(a, b);
    assert_eq!(r.active_count(), 2);
    assert!(r.remove(a).is_some());
    assert_eq!(r.active_count(), 1);
    assert!(r.get(a).is_none());
}

#[tokio::test]
async fn lsp_spawn_build_command_launches_short_lived_child() {
    let bin: PathBuf = which_sh();
    let ws = PathBuf::from("/tmp");
    let mut cmd = build_command(&bin, &["-c".into(), "exit 0".into()], &ws);
    let mut child = cmd.spawn().expect("spawn sh");
    let status = child.wait().await.expect("wait");
    assert!(status.success());
}

#[tokio::test]
async fn lsp_spawn_kill_with_grace_cleans_up_a_long_runner() {
    let bin: PathBuf = which_sh();
    let ws = PathBuf::from("/tmp");
    // Use a trap-and-loop script so bash's "exec last command" optimization
    // can't silently drop the trap.
    let script = "trap 'true' TERM; while :; do sleep 1; done";
    let mut cmd = build_command(&bin, &["-c".into(), script.into()], &ws);
    let mut child = cmd.spawn().expect("spawn sh");
    // Give the shell time to install its trap before we signal it.
    tokio::time::sleep(Duration::from_millis(100)).await;
    let graceful = kill_with_grace(&mut child, Duration::from_millis(300)).await;
    assert!(!graceful, "TERM-ignoring child must escalate to KILL");
    assert!(child.try_wait().expect("try_wait").is_some());
}

fn which_sh() -> PathBuf {
    // /bin/sh is POSIX; on macOS + Linux this is present.
    let p = PathBuf::from("/bin/sh");
    assert!(p.exists(), "/bin/sh must exist for test");
    p
}

fn tempdir(tag: &str) -> PathBuf {
    let base = std::env::temp_dir();
    let unique = format!(
        "coda-lsp-spawn-{}-{}-{}",
        tag,
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    );
    let p = base.join(unique);
    fs::create_dir_all(&p).unwrap();
    p
}
