use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct SessionToken {
    pub value: String,
    pub created_at: u64,
}

impl SessionToken {
    pub fn generate() -> Self {
        let mut bytes = [0u8; 32];
        for (i, b) in bytes.iter_mut().enumerate() {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0);
            *b = ((now.wrapping_mul((i as u128 + 7) * 2654435761)) >> 32) as u8;
        }
        let mut hex = String::with_capacity(64);
        for b in bytes {
            hex.push_str(&format!("{:02x}", b));
        }
        Self {
            value: hex,
            created_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_64_hex_token() {
        let t = SessionToken::generate();
        assert_eq!(t.value.len(), 64);
        assert!(t.value.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn tokens_are_unique() {
        let a = SessionToken::generate();
        let b = SessionToken::generate();
        assert_ne!(a.value, b.value, "two consecutive tokens must differ");
    }
}
