//! Cross-platform pseudo-terminal spawning + IO streaming.
//!
//! Each `pty_spawn` creates a new `portable_pty` session, returns a session
//! id string, and starts a background thread that reads from the pty's
//! reader and emits `pty://<session>/data` events with the raw bytes
//! (base64-encoded for transport). On exit, emits `pty://<session>/exit`
//! with the status code.
//!
//! Why events vs. a reply stream: Tauri's `invoke` is request/response.
//! Terminal output is infinite; we'd need to long-poll. Events give the
//! frontend an on-push stream out of the box.

use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};

#[derive(Default)]
pub struct PtyState {
    sessions: Arc<Mutex<HashMap<String, PtyHandle>>>,
}

struct PtyHandle {
    pair: PtyPair,
    writer: Box<dyn Write + Send>,
}

#[derive(Serialize, Clone)]
struct DataEvent {
    data: String,
}

#[derive(Serialize, Clone)]
struct ExitEvent {
    code: Option<i32>,
}

fn default_shell() -> String {
    if let Ok(s) = std::env::var("SHELL") {
        if !s.is_empty() {
            return s;
        }
    }
    if cfg!(windows) {
        "cmd.exe".to_string()
    } else if std::path::Path::new("/bin/zsh").exists() {
        "/bin/zsh".to_string()
    } else {
        "/bin/bash".to_string()
    }
}

#[tauri::command]
pub async fn pty_spawn(
    cwd: String,
    shell: Option<String>,
    rows: u16,
    cols: u16,
    app: tauri::AppHandle,
    state: State<'_, PtyState>,
) -> Result<String, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("openpty: {e}"))?;

    let shell_cmd = shell.unwrap_or_else(default_shell);
    let mut cmd = CommandBuilder::new(shell_cmd);
    cmd.cwd(cwd);
    // Preserve TERM/LANG/PATH — CommandBuilder defaults to a minimal env.
    for (k, v) in std::env::vars() {
        if matches!(
            k.as_str(),
            "PATH" | "HOME" | "USER" | "LANG" | "LC_ALL" | "TERM" | "SHELL"
        ) {
            cmd.env(k, v);
        }
    }
    // Always advertise xterm-256color — xterm.js speaks it fluently.
    cmd.env("TERM", "xterm-256color");

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("spawn: {e}"))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("clone reader: {e}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("take writer: {e}"))?;

    let id = uuid::Uuid::new_v4().to_string();
    let handle = PtyHandle { pair, writer };
    {
        let mut g = state.sessions.lock().map_err(|_| "sessions lock poisoned".to_string())?;
        g.insert(id.clone(), handle);
    }

    let sessions = state.sessions.clone();
    let id_for_thread = id.clone();
    let app_for_thread = app.clone();
    // Reader loop: stream stdout from the pty as base64-chunked data events.
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = &buf[..n];
                    let encoded = base64_encode(chunk);
                    let _ = app_for_thread.emit(
                        &format!("pty://{id_for_thread}/data"),
                        DataEvent { data: encoded },
                    );
                }
                Err(_) => break,
            }
        }
        // Reader finished: child likely exited. Surface the status and drop
        // the session.
        let code = child.wait().ok().and_then(|s| s.exit_code().try_into().ok());
        let _ = app_for_thread.emit(
            &format!("pty://{id_for_thread}/exit"),
            ExitEvent { code },
        );
        if let Ok(mut g) = sessions.lock() {
            g.remove(&id_for_thread);
        }
    });

    Ok(id)
}

#[tauri::command]
pub async fn pty_write(
    session_id: String,
    data: String,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let mut g = state
        .sessions
        .lock()
        .map_err(|_| "sessions lock poisoned".to_string())?;
    let h = g
        .get_mut(&session_id)
        .ok_or_else(|| format!("unknown session {session_id}"))?;
    h.writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("write: {e}"))?;
    h.writer.flush().map_err(|e| format!("flush: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn pty_resize(
    session_id: String,
    rows: u16,
    cols: u16,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let g = state
        .sessions
        .lock()
        .map_err(|_| "sessions lock poisoned".to_string())?;
    let h = g
        .get(&session_id)
        .ok_or_else(|| format!("unknown session {session_id}"))?;
    h.pair
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("resize: {e}"))
}

#[tauri::command]
pub async fn pty_kill(
    session_id: String,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let mut g = state
        .sessions
        .lock()
        .map_err(|_| "sessions lock poisoned".to_string())?;
    g.remove(&session_id);
    // Dropping PtyHandle drops the master + writer; the slave child sees EOF
    // on its controlling terminal and exits. The reader thread will observe
    // read==0 and emit the exit event.
    Ok(())
}

// Small base64 encoder so we don't add a whole crate dep for a 40-line helper.
fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((bytes.len() + 2) / 3) * 4);
    let mut i = 0;
    while i + 3 <= bytes.len() {
        let n = ((bytes[i] as u32) << 16) | ((bytes[i + 1] as u32) << 8) | (bytes[i + 2] as u32);
        out.push(TABLE[((n >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((n >> 12) & 0x3F) as usize] as char);
        out.push(TABLE[((n >> 6) & 0x3F) as usize] as char);
        out.push(TABLE[(n & 0x3F) as usize] as char);
        i += 3;
    }
    let rem = bytes.len() - i;
    if rem == 1 {
        let n = (bytes[i] as u32) << 16;
        out.push(TABLE[((n >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((n >> 12) & 0x3F) as usize] as char);
        out.push('=');
        out.push('=');
    } else if rem == 2 {
        let n = ((bytes[i] as u32) << 16) | ((bytes[i + 1] as u32) << 8);
        out.push(TABLE[((n >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((n >> 12) & 0x3F) as usize] as char);
        out.push(TABLE[((n >> 6) & 0x3F) as usize] as char);
        out.push('=');
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_roundtrip_known_vectors() {
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
        assert_eq!(base64_encode(b"foob"), "Zm9vYg==");
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn default_shell_nonempty() {
        let s = default_shell();
        assert!(!s.is_empty());
    }
}
