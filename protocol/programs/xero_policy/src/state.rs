use anchor_lang::prelude::*;

use crate::{constants::MAX_PROVIDERS, error::XeroError};

#[account]
#[derive(InitSpace)]
pub struct Policy {
    /// Wallet that created the policy; controls limits, allowlist, pause and withdrawals.
    pub owner: Pubkey,
    /// Key allowed to request payments.
    pub spender: Pubkey,
    pub mint: Pubkey,
    /// Largest single payment, in base units of `mint`.
    pub max_per_payment: u64,
    /// Most that can be spent within one rolling 24h window, in base units.
    pub daily_limit: u64,
    pub spent_in_window: u64,
    /// Unix timestamp of the first payment in the current window.
    pub window_start: i64,
    /// Provider wallets allowed to receive payments. Only the first `allowlist_count` are valid.
    pub allowlist: [Pubkey; MAX_PROVIDERS],
    pub allowlist_count: u8,
    pub paused: bool,
    pub bump: u8,
}

impl Policy {
    /// Sets both limits after checking that they are usable. A zero limit would silently block
    /// every payment (use `set_paused` for that), and a per-payment cap above the daily limit
    /// could never be reached.
    pub fn set_limits(&mut self, max_per_payment: u64, daily_limit: u64) -> Result<()> {
        require!(
            max_per_payment > 0 && daily_limit > 0 && max_per_payment <= daily_limit,
            XeroError::InvalidLimits
        );
        self.max_per_payment = max_per_payment;
        self.daily_limit = daily_limit;
        Ok(())
    }

    pub fn providers(&self) -> &[Pubkey] {
        &self.allowlist[..self.allowlist_count as usize]
    }

    pub fn is_allowed(&self, provider: &Pubkey) -> bool {
        self.providers().contains(provider)
    }

    pub fn add_provider(&mut self, provider: Pubkey) -> Result<()> {
        require!(!self.is_allowed(&provider), XeroError::DuplicateProvider);
        let count = self.allowlist_count as usize;
        require!(count < MAX_PROVIDERS, XeroError::AllowlistFull);
        self.allowlist[count] = provider;
        self.allowlist_count += 1;
        Ok(())
    }

    /// Removes a provider by moving the last entry into its slot. Order is not preserved.
    pub fn remove_provider(&mut self, provider: &Pubkey) -> Result<()> {
        let index = self
            .providers()
            .iter()
            .position(|p| p == provider)
            .ok_or(XeroError::ProviderNotFound)?;
        let last = self.allowlist_count as usize - 1;
        self.allowlist[index] = self.allowlist[last];
        self.allowlist[last] = Pubkey::default();
        self.allowlist_count -= 1;
        Ok(())
    }
}
