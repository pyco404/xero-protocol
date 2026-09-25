pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("EK8aHDV1rgmoi7aygKCptretPMwQ9b6U293dioDLGZYW");

#[program]
pub mod zero_policy {
    use super::*;

    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        spender: Pubkey,
        max_per_payment: u64,
        daily_limit: u64,
        allowlist: Vec<Pubkey>,
    ) -> Result<()> {
        instructions::create_policy::handle_create_policy(
            ctx,
            spender,
            max_per_payment,
            daily_limit,
            allowlist,
        )
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handle_deposit(ctx, amount)
    }

    pub fn update_limits(
        ctx: Context<OwnerOnly>,
        max_per_payment: u64,
        daily_limit: u64,
    ) -> Result<()> {
        instructions::owner_only::handle_update_limits(ctx, max_per_payment, daily_limit)
    }

    pub fn add_provider(ctx: Context<OwnerOnly>, provider: Pubkey) -> Result<()> {
        instructions::owner_only::handle_add_provider(ctx, provider)
    }

    pub fn remove_provider(ctx: Context<OwnerOnly>, provider: Pubkey) -> Result<()> {
        instructions::owner_only::handle_remove_provider(ctx, provider)
    }

    pub fn set_paused(ctx: Context<OwnerOnly>, paused: bool) -> Result<()> {
        instructions::owner_only::handle_set_paused(ctx, paused)
    }

    pub fn pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
        instructions::pay::handle_pay(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handle_withdraw(ctx, amount)
    }

    pub fn close_policy(ctx: Context<ClosePolicy>) -> Result<()> {
        instructions::close_policy::handle_close_policy(ctx)
    }
}
