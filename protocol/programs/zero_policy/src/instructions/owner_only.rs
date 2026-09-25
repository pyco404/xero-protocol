use anchor_lang::prelude::*;

use crate::{
    error::ZeroError,
    events::{LimitsUpdated, PauseChanged, ProviderAdded, ProviderRemoved},
    state::Policy,
};

/// Accounts for instructions that only change policy settings.
#[derive(Accounts)]
pub struct OwnerOnly<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ ZeroError::Unauthorized)]
    pub policy: Account<'info, Policy>,
}

pub fn handle_update_limits(
    ctx: Context<OwnerOnly>,
    max_per_payment: u64,
    daily_limit: u64,
) -> Result<()> {
    ctx.accounts
        .policy
        .set_limits(max_per_payment, daily_limit)?;
    emit!(LimitsUpdated {
        policy: ctx.accounts.policy.key(),
        max_per_payment,
        daily_limit,
    });
    Ok(())
}

pub fn handle_add_provider(ctx: Context<OwnerOnly>, provider: Pubkey) -> Result<()> {
    ctx.accounts.policy.add_provider(provider)?;
    emit!(ProviderAdded {
        policy: ctx.accounts.policy.key(),
        provider,
    });
    Ok(())
}

pub fn handle_remove_provider(ctx: Context<OwnerOnly>, provider: Pubkey) -> Result<()> {
    ctx.accounts.policy.remove_provider(&provider)?;
    emit!(ProviderRemoved {
        policy: ctx.accounts.policy.key(),
        provider,
    });
    Ok(())
}

pub fn handle_set_paused(ctx: Context<OwnerOnly>, paused: bool) -> Result<()> {
    ctx.accounts.policy.paused = paused;
    emit!(PauseChanged {
        policy: ctx.accounts.policy.key(),
        paused,
    });
    Ok(())
}
