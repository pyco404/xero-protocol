use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{constants::*, error::XeroError, events::PaymentSettled, state::Policy};

#[derive(Accounts)]
pub struct Pay<'info> {
    pub spender: Signer<'info>,
    #[account(mut, has_one = spender @ XeroError::Unauthorized, has_one = mint)]
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
    require!(!policy.paused, XeroError::Paused);
    require!(policy.is_allowed(&provider), XeroError::RecipientNotAllowed);
    require!(amount > 0, XeroError::ZeroAmount);
    require!(
        amount <= policy.max_per_payment,
        XeroError::AmountExceedsMaxPayment
    );

    // Rolling 24h window that starts at the first payment after the previous window ends.
    let now = Clock::get()?.unix_timestamp;
    let elapsed = now
        .checked_sub(policy.window_start)
        .ok_or(XeroError::MathOverflow)?;
    if elapsed >= WINDOW_SECONDS {
        policy.window_start = now;
        policy.spent_in_window = 0;
    }
    let spent = policy
        .spent_in_window
        .checked_add(amount)
        .ok_or(XeroError::MathOverflow)?;
    require!(spent <= policy.daily_limit, XeroError::DailyLimitExceeded);
    policy.spent_in_window = spent;

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
        recipient: provider,
        amount,
        spent_in_window: spent,
    });
    Ok(())
}
