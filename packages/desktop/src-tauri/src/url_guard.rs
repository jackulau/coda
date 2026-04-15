pub fn is_local_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    let stripped = lower
        .strip_prefix("http://")
        .or_else(|| lower.strip_prefix("https://"))
        .unwrap_or(&lower);

    let host = if let Some(rest) = stripped.strip_prefix('[') {
        match rest.split_once(']') {
            Some((h, _)) => h.to_string(),
            None => return false,
        }
    } else {
        stripped
            .split(['/', ':', '?', '#'])
            .next()
            .unwrap_or("")
            .to_string()
    };

    matches!(host.as_str(), "127.0.0.1" | "::1" | "localhost")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_localhost_urls() {
        assert!(is_local_url("http://127.0.0.1:3000"));
        assert!(is_local_url("http://localhost:5173/app"));
        assert!(is_local_url("https://[::1]:8080"));
        assert!(is_local_url("http://localhost"));
    }

    #[test]
    fn rejects_external_urls() {
        assert!(!is_local_url("https://evil.com"));
        assert!(!is_local_url("https://127.0.0.1.evil.com"));
        assert!(!is_local_url("https://api.github.com"));
    }

    #[test]
    fn rejects_meta_refresh_target() {
        assert!(!is_local_url("https://attacker.example/path"));
    }

    #[test]
    fn rejects_unbracketed_ipv6_lookalike() {
        assert!(!is_local_url("https://evil[::1].com"));
    }

    #[test]
    fn rejects_unclosed_ipv6_bracket() {
        assert!(!is_local_url("https://[::1"));
    }
}
