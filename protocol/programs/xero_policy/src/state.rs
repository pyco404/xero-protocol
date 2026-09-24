use anchor_lang::prelude::*;

use crate::{
    constants::{BUCKET_SECONDS, MAX_PROVIDERS, POLICY_RESERVED_BYTES, WINDOW_BUCKETS},
    error::XeroError,
};

const BUCKETS: usize = WINDOW_BUCKETS as usize;

#[account]
#[derive(InitSpace)]
pub struct Policy {
    /// Layout version (`POLICY_VERSION`).
    pub version: u8,
    /// Wallet that created the policy; controls limits, allowlist, pause and withdrawals.
    pub owner: Pubkey,
    /// Key allowed to request payments.
    pub spender: Pubkey,
    pub mint: Pubkey,
    /// Largest single payment, in base units of `mint`.
    pub max_per_payment: u64,
    /// Most that can be spent across the last `WINDOW_BUCKETS` hourly buckets, in base units.
    pub daily_limit: u64,
    /// Amount paid in each hour, indexed by `hour % WINDOW_BUCKETS`, where
    /// `hour = unix_timestamp / BUCKET_SECONDS`. Only buckets for the 24 hours up to and
    /// including `last_hour` are meaningful; older ones are cleared lazily on the next payment.
    pub buckets: [u64; BUCKETS],
    /// Hour (`unix_timestamp / BUCKET_SECONDS`) of the most recent payment; 0 before the first.
    pub last_hour: i64,
    /// Provider wallets allowed to receive payments. Only the first `allowlist_count` are valid.
    pub allowlist: [Pubkey; MAX_PROVIDERS],
    pub allowlist_count: u8,
    pub paused: bool,
    pub bump: u8,
    /// Reserved for future fields; always zero in version 1.
    pub _reserved: [u8; POLICY_RESERVED_BYTES],
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

    /// Advances the window to the hour containing `now`, zeroing the buckets of every hour that
    /// has left the window. A clock that moved backwards leaves the buckets unchanged.
    fn roll_to(&mut self, hour: i64) {
        if hour <= self.last_hour {
            return;
        }
        let elapsed = hour - self.last_hour;
        if elapsed >= WINDOW_BUCKETS as i64 {
            self.buckets = [0; BUCKETS];
        } else {
            for h in self.last_hour + 1..=hour {
                self.buckets[bucket_index(h)] = 0;
            }
        }
        self.last_hour = hour;
    }

    /// Sum of the buckets currently in the window.
    pub fn spent_in_window(&self) -> Result<u64> {
        self.buckets
            .iter()
            .try_fold(0u64, |sum, b| sum.checked_add(*b))
            .ok_or_else(|| error!(XeroError::MathOverflow))
    }

    /// Records a payment of `amount` at unix time `now` if the last 24 hourly buckets plus
    /// `amount` stay within `daily_limit`. Returns the window total after the payment.
    pub fn record_spend(&mut self, now: i64, amount: u64) -> Result<u64> {
        let hour = now.div_euclid(BUCKET_SECONDS);
        self.roll_to(hour);
        let spent = self
            .spent_in_window()?
            .checked_add(amount)
            .ok_or(XeroError::MathOverflow)?;
        require!(spent <= self.daily_limit, XeroError::DailyLimitExceeded);
        // If the clock moved backwards (hour < last_hour), this bucket still lies inside the
        // window, so the amount is never dropped; at worst it is counted for too long.
        let index = bucket_index(hour);
        self.buckets[index] = self.buckets[index]
            .checked_add(amount)
            .ok_or(XeroError::MathOverflow)?;
        Ok(spent)
    }
}

fn bucket_index(hour: i64) -> usize {
    hour.rem_euclid(WINDOW_BUCKETS as i64) as usize
}

#[cfg(test)]
mod tests {
    use super::*;

    const H: i64 = BUCKET_SECONDS;
    // An hour boundary (1_790_002_800 = 497_223 * 3600), so offsets below are exact.
    const T0: i64 = 497_223 * H;

    fn policy(daily_limit: u64) -> Policy {
        Policy {
            version: 1,
            owner: Pubkey::default(),
            spender: Pubkey::default(),
            mint: Pubkey::default(),
            max_per_payment: daily_limit,
            daily_limit,
            buckets: [0; BUCKETS],
            last_hour: 0,
            allowlist: [Pubkey::default(); MAX_PROVIDERS],
            allowlist_count: 0,
            paused: false,
            bump: 0,
            _reserved: [0; POLICY_RESERVED_BYTES],
        }
    }

    #[test]
    fn rejects_the_old_2x_burst_across_a_window_boundary() {
        let mut p = policy(20);
        assert_eq!(p.record_spend(T0, 1).unwrap(), 1);
        // 23h59m later: 19 more, 20 in total.
        assert_eq!(p.record_spend(T0 + 24 * H - 60, 19).unwrap(), 20);
        // The old fixed window reset here and allowed another full 20.
        assert!(p.record_spend(T0 + 24 * H, 20).is_err());
        // Now only the 1 from hour 0 has left the window: exactly 1 more fits, then nothing.
        assert_eq!(p.record_spend(T0 + 24 * H, 1).unwrap(), 20);
        assert!(p.record_spend(T0 + 24 * H + 60, 1).is_err());
    }

    #[test]
    fn a_payment_counts_until_the_24th_hour_boundary_after_it() {
        let mut p = policy(10);
        p.record_spend(T0 + 30 * 60, 10).unwrap(); // hour 0, half past
        assert!(p.record_spend(T0 + 24 * H - 1, 1).is_err()); // still inside hour 23
        assert_eq!(p.record_spend(T0 + 24 * H, 10).unwrap(), 10); // hour 24: released
    }

    #[test]
    fn sums_payments_spread_over_the_window() {
        let mut p = policy(24);
        for hour in 0..24 {
            p.record_spend(T0 + hour * H, 1).unwrap();
        }
        assert!(p.record_spend(T0 + 23 * H + 59 * 60, 1).is_err());
        // Each new hour frees exactly the hour that fell out.
        assert_eq!(p.record_spend(T0 + 24 * H, 1).unwrap(), 24);
        assert!(p.record_spend(T0 + 24 * H, 1).is_err());
    }

    #[test]
    fn clears_everything_after_a_gap_of_a_day_or_more() {
        let mut p = policy(10);
        p.record_spend(T0, 10).unwrap();
        assert_eq!(p.record_spend(T0 + 100 * H, 10).unwrap(), 10);
    }

    #[test]
    fn a_clock_moving_backwards_never_drops_spend() {
        let mut p = policy(10);
        p.record_spend(T0 + 5 * H, 6).unwrap();
        assert!(p.record_spend(T0 + 4 * H, 5).is_err());
        assert_eq!(p.record_spend(T0 + 4 * H, 4).unwrap(), 10);
    }
}
