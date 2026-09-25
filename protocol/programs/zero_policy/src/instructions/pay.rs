use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{constants::*, error::ZeroError, events::PaymentSettled, state::Policy};

#[derive(Accounts)]
pub struct Pay<'info> {
    pub spender: Signer<'info>,
    #[account(mut, has_one = spender @ ZeroError::Unauthorized, has_one = mint)]
    pub policy: Account<'info, Policy>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [VAULT_SEED, policy.key().as_ref()], bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    /// Token account of the provider being paid. Its owner must be allowlisted.
    #[account(mut, token::mint = mint, token::token_program = token_program)]
    pub recipient: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
    let provider = ctx.accounts.recipient.owner;
    let policy = &mut ctx.accounts.policy;

    // Checks run in a fixed order so callers get the most relevant error first.
    require!(!policy.paused, ZeroError::Paused);
    require!(policy.is_allowed(&provider), ZeroError::RecipientNotAllowed);
    require!(amount > 0, ZeroError::ZeroAmount);
    require!(
        amount <= policy.max_per_payment,
        ZeroError::AmountExceedsMaxPayment
    );

    // Rolling window: the last 24 hourly buckets plus this payment must fit the daily limit.
    let now = Clock::get()?.unix_timestamp;
    let spent = policy.record_spend(now, amount)?;
    let daily_limit = policy.daily_limit;

    let (owner, spender, bump) = (policy.owner, policy.spender, policy.bump);
    let signer_seeds: &[&[&[u8]]] = &[&[POLICY_SEED, owner.as_ref(), spender.as_ref(), &[bump]]];
    let accounts = TransferChecked {
        from: ctx.accounts.vault.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.recipient.to_account_info(),
        authority: ctx.accounts.policy.to_account_info(),
    };
    token_interface::transfer_checked(
        CpiContext::new_with_signer(ctx.accounts.token_program.key(), accounts, signer_seeds),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    emit!(PaymentSettled {
        policy: ctx.accounts.policy.key(),
        spender,
        mint: ctx.accounts.mint.key(),
        recipient: provider,
        recipient_token_account: ctx.accounts.recipient.key(),
        amount,
        spent_in_window: spent,
        daily_limit,
        timestamp: now,
    });
    Ok(())
}
