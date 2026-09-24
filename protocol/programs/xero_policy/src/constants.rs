use anchor_lang::prelude::*;

#[constant]
pub const POLICY_SEED: &[u8] = b"policy";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// Maximum number of providers a policy can allowlist.
pub const MAX_PROVIDERS: usize = 8;

/// Width of one spending bucket, in seconds (one hour).
#[constant]
pub const BUCKET_SECONDS: i64 = 60 * 60;

/// Number of hourly buckets in the spending window. The daily limit applies to the sum of the
/// current hour's bucket and the 23 before it, so a payment counts against the limit until the
/// 24th hour boundary after it: for at least 23 and at most 24 hours.
#[constant]
pub const WINDOW_BUCKETS: u8 = 24;

/// Layout version of the `Policy` account.
#[constant]
pub const POLICY_VERSION: u8 = 1;

/// Bytes reserved at the end of `Policy` for future fields.
pub const POLICY_RESERVED_BYTES: usize = 64;
