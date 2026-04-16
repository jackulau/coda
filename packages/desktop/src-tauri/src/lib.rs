use std::sync::Mutex;

pub mod lsp_spawn;
pub mod sidecar_token;
pub mod url_guard;

#[cfg(test)]
mod lsp_spawn_test;

#[cfg(test)]
mod tests_extra;

pub use sidecar_token::SessionToken;
pub use url_guard::is_local_url;

#[derive(Default)]
pub struct AppState {
    pub session_token: Mutex<Option<SessionToken>>,
}

impl AppState {
    pub fn with_fresh_token() -> Self {
        let s = Self::default();
        if let Ok(mut g) = s.session_token.lock() {
            *g = Some(SessionToken::generate());
        }
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_state_seeds_session_token() {
        let s = AppState::with_fresh_token();
        let g = s.session_token.lock().expect("lock");
        let token = g.as_ref().expect("token populated");
        assert_eq!(token.value.len(), 64);
    }
}
