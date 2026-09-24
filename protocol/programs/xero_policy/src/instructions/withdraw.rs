use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{constants::*, error::XeroError, events::Withdrawn, state::Policy};

/// Owner withdrawal. Deliberately ignores `paused` so funds are always recoverable.
#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub owner: Signer<'info>,
    #[account(has_one = owner @ XeroError::Unauthorized, has_one = mint)]
    pub policy: Account<'info, Policy>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [VAULT_SEED, policy.key().as_ref()], bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::token_program = token_program)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, XeroError::ZeroAmount);
    let policy = &ctx.accounts.policy;
    let signer_seeds: &[&[&[u8]]] = &[&[
        POLICY_SEED,
        policy.owner.as_ref(),
        policy.spender.as_ref(),
        &[policy.bump],
    ]];
    let accounts = TransferChecked {
        from: ctx.accounts.vault.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.destination.to_account_info(),
        authority: policy.to_account_info(),
    };
    token_interface::transfer_checked(
        CpiContext::new_with_signer(ctx.accounts.token_program.key(), accounts, signer_seeds),
        amount,
        ctx.accounts.mint.decimals,
    )?;
    emit!(Withdrawn {
        policy: ctx.accounts.policy.key(),
        owner: ctx.accounts.owner.key(),
        destination: ctx.accounts.destination.key(),
        amount,
    });
    Ok(())
}
