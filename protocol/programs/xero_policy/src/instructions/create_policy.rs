use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::spl_token_2022::{
        self,
        extension::{BaseStateWithExtensions, ExtensionType, StateWithExtensions},
    },
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{constants::*, error::XeroError, events::PolicyCreated, state::Policy};

#[derive(Accounts)]
#[instruction(spender: Pubkey)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Policy::INIT_SPACE,
        seeds = [POLICY_SEED, owner.key().as_ref(), spender.as_ref()],
        bump
    )]
    pub policy: Account<'info, Policy>,
    // Checked before the vault is created, so an unsupported mint fails with UnsupportedMint.
    #[account(
        mint::token_program = token_program,
        constraint = is_supported_mint(&mint.to_account_info()) @ XeroError::UnsupportedMint
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = owner,
        seeds = [VAULT_SEED, policy.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = policy,
        token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_policy(
    ctx: Context<CreatePolicy>,
    spender: Pubkey,
    max_per_payment: u64,
    daily_limit: u64,
    allowlist: Vec<Pubkey>,
) -> Result<()> {
    require!(allowlist.len() <= MAX_PROVIDERS, XeroError::AllowlistFull);

    let policy = &mut ctx.accounts.policy;
    policy.version = POLICY_VERSION;
    policy.owner = ctx.accounts.owner.key();
    policy.spender = spender;
    policy.mint = ctx.accounts.mint.key();
    policy.set_limits(max_per_payment, daily_limit)?;
    policy.buckets = [0; WINDOW_BUCKETS as usize];
    policy.last_hour = 0;
    policy.allowlist = [Pubkey::default(); MAX_PROVIDERS];
    policy.allowlist_count = 0;
    policy.paused = false;
    policy.bump = ctx.bumps.policy;
    policy._reserved = [0; POLICY_RESERVED_BYTES];

    for provider in &allowlist {
        policy.add_provider(*provider)?;
    }

    emit!(PolicyCreated {
        policy: policy.key(),
        owner: policy.owner,
        spender,
        mint: policy.mint,
        max_per_payment,
        daily_limit,
        allowlist,
    });
    Ok(())
}

/// Token-2022 extensions that do not change how many tokens a transfer moves or who can move
/// them. Anything else (transfer fees, transfer hooks, permanent delegates, confidential
/// transfers, non-transferable, pausable, interest-bearing or scaled UI amounts, default-frozen
/// accounts, ...) would break the vault's accounting or the spender's limits, so it is rejected.
const SUPPORTED_EXTENSIONS: &[ExtensionType] = &[
    ExtensionType::MintCloseAuthority,
    ExtensionType::MetadataPointer,
    ExtensionType::TokenMetadata,
    ExtensionType::GroupPointer,
    ExtensionType::TokenGroup,
    ExtensionType::GroupMemberPointer,
    ExtensionType::TokenGroupMember,
];

/// SPL Token mints are always supported; Token-2022 mints only with `SUPPORTED_EXTENSIONS`.
fn is_supported_mint(mint: &AccountInfo) -> bool {
    if *mint.owner != spl_token_2022::ID {
        return true;
    }
    let data = mint.try_borrow_data();
    let Ok(data) = data else { return false };
    let Ok(state) = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&data) else {
        return false;
    };
    let Ok(extensions) = state.get_extension_types() else {
        return false;
    };
    extensions
        .iter()
        .all(|extension| SUPPORTED_EXTENSIONS.contains(extension))
}
