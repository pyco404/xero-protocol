use anchor_lang::prelude::*;

#[constant]
pub const POLICY_SEED: &[u8] = b"policy";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// Maximum number of providers a policy can allowlist.
pub const MAX_PROVIDERS: usize = 8;

/// Length of the rolling spending window, in seconds.
#[constant]
pub const WINDOW_SECONDS: i64 = 24 * 60 * 60;
