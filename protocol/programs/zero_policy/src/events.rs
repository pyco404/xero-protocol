use anchor_lang::prelude::*;

#[event]
pub struct PolicyCreated {
    pub policy: Pubkey,
    pub owner: Pubkey,
    pub spender: Pubkey,
    pub mint: Pubkey,
    pub max_per_payment: u64,
    pub daily_limit: u64,
    pub allowlist: Vec<Pubkey>,
}

#[event]
pub struct Deposited {
    pub policy: Pubkey,
    pub owner: Pubkey,
    /// Owner token account the tokens came from.
    pub source: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PaymentSettled {
    pub policy: Pubkey,
    pub spender: Pubkey,
    pub mint: Pubkey,
    /// Provider wallet (owner of the recipient token account).
    pub recipient: Pubkey,
    /// Token account that received the payment.
    pub recipient_token_account: Pubkey,
    pub amount: u64,
    /// Total paid across the last 24 hourly buckets, including this payment.
    pub spent_in_window: u64,
    pub daily_limit: u64,
    /// Cluster unix time of the payment.
    pub timestamp: i64,
}

#[event]
pub struct Withdrawn {
    pub policy: Pubkey,
    pub owner: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

#[event]
pub struct LimitsUpdated {
    pub policy: Pubkey,
    pub max_per_payment: u64,
    pub daily_limit: u64,
}

#[event]
pub struct ProviderAdded {
    pub policy: Pubkey,
    pub provider: Pubkey,
}

#[event]
pub struct ProviderRemoved {
    pub policy: Pubkey,
    pub provider: Pubkey,
}

#[event]
pub struct PauseChanged {
    pub policy: Pubkey,
    pub paused: bool,
}

#[event]
pub struct PolicyClosed {
    pub policy: Pubkey,
    pub owner: Pubkey,
    /// Token account that received the swept vault balance.
    pub destination: Pubkey,
    /// Vault balance swept to `destination` (may be 0).
    pub swept: u64,
}
