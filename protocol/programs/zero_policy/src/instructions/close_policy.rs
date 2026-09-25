use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{constants::*, error::ZeroError, events::PolicyClosed, state::Policy};

/// Sweeps whatever is left in the vault to `destination`, then closes the vault and the policy
/// and returns their rent to the owner. Like `withdraw`, it works while paused.
#[derive(Accounts)]
pub struct ClosePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, close = owner, has_one = owner @ ZeroError::Unauthorized, has_one = mint)]
    pub policy: Account<'info, Policy>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [VAULT_SEED, policy.key().as_ref()], bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::token_program = token_program)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_close_policy(ctx: Context<ClosePolicy>) -> Result<()> {
    let policy = &ctx.accounts.policy;
    let signer_seeds: &[&[&[u8]]] = &[&[
        POLICY_SEED,
        policy.owner.as_ref(),
        policy.spender.as_ref(),
        &[policy.bump],
    ]];

    let remaining = ctx.accounts.vault.amount;
    if remaining > 0 {
        let accounts = TransferChecked {
            from: ctx.accounts.vault.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: policy.to_account_info(),
        };
        token_interface::transfer_checked(
            CpiContext::new_with_signer(ctx.accounts.token_program.key(), accounts, signer_seeds),
            remaining,
            ctx.accounts.mint.decimals,
        )?;
    }

    let accounts = CloseAccount {
        account: ctx.accounts.vault.to_account_info(),
        destination: ctx.accounts.owner.to_account_info(),
        authority: policy.to_account_info(),
    };
    token_interface::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        accounts,
        signer_seeds,
    ))?;
    emit!(PolicyClosed {
        policy: ctx.accounts.policy.key(),
        owner: ctx.accounts.owner.key(),
        destination: ctx.accounts.destination.key(),
        swept: remaining,
    });
    Ok(())
}
