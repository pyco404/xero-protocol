use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{constants::*, error::XeroError, events::Deposited, state::Policy};

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub owner: Signer<'info>,
    #[account(has_one = owner @ XeroError::Unauthorized, has_one = mint)]
    pub policy: Account<'info, Policy>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = owner,
        token::token_program = token_program
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [VAULT_SEED, policy.key().as_ref()], bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, XeroError::ZeroAmount);
    let accounts = TransferChecked {
        from: ctx.accounts.owner_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    token_interface::transfer_checked(
        CpiContext::new(ctx.accounts.token_program.key(), accounts),
        amount,
        ctx.accounts.mint.decimals,
    )?;
    emit!(Deposited {
        policy: ctx.accounts.policy.key(),
        owner: ctx.accounts.owner.key(),
        source: ctx.accounts.owner_token_account.key(),
        amount,
    });
    Ok(())
}
