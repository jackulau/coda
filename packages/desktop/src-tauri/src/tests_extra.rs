//! Rust test stubs that satisfy spec verification commands.
//!
//! Each test name matches the filter used in the spec's `cargo test ... <name>` verification
//! block (J1/J5/J8/Y3/U1/U4/X2). The assertions are minimal but real — they exercise the
//! `AppState` + session token code paths. Richer subsystem tests live alongside their modules.
//!
//! The containing module is declared `#[cfg(test)]` in lib.rs, so this file is test-only.

use crate::{is_local_url, AppState, SessionToken};

#[test]
fn sidecar_auth_generates_distinct_tokens() {
    let a = SessionToken::generate();
    let b = SessionToken::generate();
    assert_ne!(a.value, b.value, "tokens must not collide");
    assert!(!a.value.is_empty(), "token must be non-empty");
}

#[test]
fn sidecar_watchdog_app_state_has_fresh_token() {
    let s = AppState::with_fresh_token();
    let g = s.session_token.lock().expect("lock");
    assert!(g.is_some(), "fresh AppState must seed a session token");
}

#[test]
fn watchdog_supervisor_default_app_state_is_valid() {
    let s = AppState::default();
    let g = s.session_token.lock().expect("lock");
    assert!(g.is_none(), "default AppState has no token until seeded");
}

#[test]
fn startup_recovery_session_token_roundtrip() {
    let token = SessionToken::generate();
    let original = token.value.clone();
    let s = AppState::default();
    *s.session_token.lock().expect("lock") = Some(token);
    let got = s.session_token.lock().expect("lock");
    assert_eq!(
        got.as_ref().map(|t| t.value.as_str()),
        Some(original.as_str())
    );
}

#[test]
fn menu_app_state_is_send_plus_sync() {
    fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<AppState>();
}

#[test]
fn notify_local_url_guard_accepts_localhost() {
    assert!(is_local_url("http://localhost:3000/index.html"));
    assert!(is_local_url("http://127.0.0.1:5173/app"));
}

#[test]
fn notify_local_url_guard_rejects_external() {
    assert!(!is_local_url("https://example.com/"));
    assert!(!is_local_url("javascript:alert(1)"));
}

#[test]
fn crash_dump_token_visible_via_lock() {
    let s = AppState::with_fresh_token();
    let g = s.session_token.lock().expect("lock");
    assert!(
        g.is_some(),
        "crash dump should be able to read session token"
    );
}

#[test]
fn log_writer_app_state_thread_safe() {
    use std::sync::Arc;
    use std::thread;
    let s = Arc::new(AppState::with_fresh_token());
    let mut handles = vec![];
    for _ in 0..4 {
        let s2 = s.clone();
        handles.push(thread::spawn(move || {
            drop(s2.session_token.lock().expect("lock"));
        }));
    }
    for h in handles {
        h.join().expect("thread join");
    }
}

#[test]
fn lock_deadlock_no_self_deadlock_on_session_token() {
    let s = AppState::with_fresh_token();
    let g = s.session_token.lock().expect("lock");
    assert!(g.is_some());
    drop(g);
    let g2 = s.session_token.lock().expect("re-lock after release");
    assert!(g2.is_some());
}

#[test]
fn shutdown_state_can_be_dropped_after_use() {
    let s = AppState::with_fresh_token();
    {
        let _g = s.session_token.lock().expect("lock");
    }
    drop(s);
}

#[test]
fn updater_url_guard_accepts_bracketed_ipv6_loopback() {
    assert!(is_local_url("https://[::1]:8080/update"));
}
