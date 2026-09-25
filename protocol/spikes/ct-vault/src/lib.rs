//! Throwaway spike (Q3 + Q4): a program-controlled vault holding *confidential* Token-2022 funds.
//!
//! - The vault token account's owner (authority) is the `policy` PDA; only this program can move
//!   funds, via CPI with `invoke_signed`.
//! - The vault's ElGamal/AES keys live off-chain with whoever generates proofs (the spender here).
//!   The program never sees a key or a plaintext amount.
//! - `Pay` CPIs a confidential transfer using proof *context accounts* verified beforehand, and
//!   (optionally) enforces max_per_payment and daily_limit on the *encrypted* amount:
//!
//!     amount ciphertext (under the vault key) := lo + 2^16 * hi, taken from the transfer's own
//!                                               ciphertext-validity context
//!     max_diff  = Enc(max, r=0)   - amount          -> must encrypt a value in [0, 2^64)
//!     remaining = Enc(daily, r=0) - (total + amount) -> must encrypt a value in [0, 2^64)
//!
//!   Each is tied to a Pedersen commitment by a ciphertext-commitment equality proof, and both
//!   commitments are range-proven (64 bits each) by one batched U128 range proof. If
//!   amount > max, max - amount wraps around the group order and no 64-bit range proof exists.
//!   The encrypted running total `total` lives in the policy account (homomorphic addition).
//!
//! Localnet only. No audits, no tests beyond the spike driver. Do not reuse.

use {
    bytemuck::{Pod, Zeroable},
    solana_program::{
        account_info::{next_account_info, AccountInfo},
        clock::Clock,
        entrypoint::ProgramResult,
        msg,
        program::invoke_signed,
        program_error::ProgramError,
        pubkey::Pubkey,
        rent::Rent,
        sysvar::Sysvar,
    },
    solana_system_interface::instruction as system_ix,
    solana_zk_elgamal_proof_interface::proof_data::{
        BatchedGroupedCiphertext3HandlesValidityProofContext,
        BatchedGroupedCiphertext3HandlesValidityProofData, BatchedRangeProofContext,
        BatchedRangeProofU128Data, CiphertextCommitmentEqualityProofContext,
        CiphertextCommitmentEqualityProofData,
    },
    solana_zk_sdk_pod::encryption::{
        auth_encryption::PodAeCiphertext, elgamal::PodElGamalCiphertext,
    },
    spl_token_2022_interface::extension::{
        confidential_transfer::{instruction as ct_ix, ConfidentialTransferAccount},
        BaseStateWithExtensions, StateWithExtensions,
    },
    spl_token_confidential_transfer_ciphertext_arithmetic as arith,
    spl_token_confidential_transfer_proof_extraction::instruction::{
        verify_and_extract_context, ProofLocation,
    },
};

#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process);

pub const POLICY_SEED: &[u8] = b"policy";
pub const MAX_PROVIDERS: usize = 4;
pub const WINDOW_SECONDS: i64 = 86_400;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct Policy {
    pub spender: Pubkey,
    pub max_per_payment: u64,
    pub daily_limit: u64,
    pub window_start: i64,
    /// Encrypted (under the vault's ElGamal key) total paid in the current window.
    pub spent_ciphertext: PodElGamalCiphertext,
    pub allowlist: [Pubkey; MAX_PROVIDERS],
    pub allowlist_count: u8,
    pub bump: u8,
    pub _pad: [u8; 6],
}

pub fn policy_address(program_id: &Pubkey, spender: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[POLICY_SEED, spender.as_ref()], program_id)
}

fn err(msg: &str) -> ProgramError {
    msg!("ct-vault: {}", msg);
    ProgramError::Custom(1)
}

pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let (tag, rest) = data.split_first().ok_or(ProgramError::InvalidInstructionData)?;
    match tag {
        0 => init_policy(program_id, accounts, rest),
        1 => configure(program_id, accounts, rest),
        2 => deposit(program_id, accounts, rest),
        3 => apply_pending(program_id, accounts, rest),
        4 => pay(program_id, accounts, rest),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn read<T: Pod>(data: &[u8], at: &mut usize) -> Result<T, ProgramError> {
    let size = core::mem::size_of::<T>();
    let bytes = data.get(*at..*at + size).ok_or(ProgramError::InvalidInstructionData)?;
    *at += size;
    Ok(bytemuck::pod_read_unaligned(bytes))
}

/// Checks the spender signed and owns this policy; returns the policy and its signer seeds' bump.
fn load_policy(
    program_id: &Pubkey,
    spender: &AccountInfo,
    policy: &AccountInfo,
) -> Result<Policy, ProgramError> {
    if !spender.is_signer {
        return Err(err("spender must sign"));
    }
    if policy.owner != program_id {
        return Err(err("policy not owned by program"));
    }
    let state: Policy = bytemuck::pod_read_unaligned(&policy.data.borrow());
    if state.spender != *spender.key {
        return Err(err("wrong spender"));
    }
    Ok(state)
}

fn signed<F: FnOnce(&[&[&[u8]]]) -> ProgramResult>(state: &Policy, f: F) -> ProgramResult {
    let bump = [state.bump];
    f(&[&[POLICY_SEED, state.spender.as_ref(), &bump]])
}

/// 0: InitPolicy { max u64, daily u64, count u8, allowlist [Pubkey; 4] }
/// accounts: spender (signer, payer), policy (pda, writable), system program
fn init_policy(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let it = &mut accounts.iter();
    let spender = next_account_info(it)?;
    let policy = next_account_info(it)?;
    let system = next_account_info(it)?;
    let mut at = 0;
    let max_per_payment: u64 = read(data, &mut at)?;
    let daily_limit: u64 = read(data, &mut at)?;
    let allowlist_count: u8 = read(data, &mut at)?;
    let allowlist: [Pubkey; MAX_PROVIDERS] = read(data, &mut at)?;
    let (address, bump) = policy_address(program_id, spender.key);
    if address != *policy.key || !spender.is_signer {
        return Err(err("bad policy address or missing signature"));
    }
    let space = core::mem::size_of::<Policy>();
    invoke_signed(
        &system_ix::create_account(spender.key, policy.key, Rent::get()?.minimum_balance(space), space as u64, program_id),
        &[spender.clone(), policy.clone(), system.clone()],
        &[&[POLICY_SEED, spender.key.as_ref(), &[bump]]],
    )?;
    let state = Policy {
        spender: *spender.key,
        max_per_payment,
        daily_limit,
        window_start: 0,
        spent_ciphertext: PodElGamalCiphertext::zeroed(),
        allowlist,
        allowlist_count,
        bump,
        _pad: [0; 6],
    };
    policy.data.borrow_mut().copy_from_slice(bytemuck::bytes_of(&state));
    Ok(())
}

/// 1: Configure { decryptable_zero PodAeCiphertext, max_pending u64 }
/// accounts: spender (s), policy, vault token (w), mint, pubkey-validity context, token program
fn configure(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let it = &mut accounts.iter();
    let (spender, policy, vault, mint, ctx, token) = (
        next_account_info(it)?, next_account_info(it)?, next_account_info(it)?,
        next_account_info(it)?, next_account_info(it)?, next_account_info(it)?,
    );
    let state = load_policy(program_id, spender, policy)?;
    let mut at = 0;
    let decryptable_zero: PodAeCiphertext = read(data, &mut at)?;
    let max_pending: u64 = read(data, &mut at)?;
    let ixs = ct_ix::configure_account(
        token.key, vault.key, mint.key, &decryptable_zero, max_pending, policy.key, &[],
        ProofLocation::ContextStateAccount(ctx.key),
    )?;
    signed(&state, |seeds| {
        invoke_signed(&ixs[0], &[vault.clone(), mint.clone(), ctx.clone(), policy.clone(), token.clone()], seeds)
    })
}

/// 2: Deposit { amount u64, decimals u8 }: vault's public balance -> its pending balance.
/// accounts: spender (s), policy, vault token (w), mint, token program
fn deposit(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let it = &mut accounts.iter();
    let (spender, policy, vault, mint, token) = (
        next_account_info(it)?, next_account_info(it)?, next_account_info(it)?,
        next_account_info(it)?, next_account_info(it)?,
    );
    let state = load_policy(program_id, spender, policy)?;
    let mut at = 0;
    let amount: u64 = read(data, &mut at)?;
    let decimals: u8 = read(data, &mut at)?;
    let ix = ct_ix::deposit(token.key, vault.key, mint.key, amount, decimals, policy.key, &[])?;
    signed(&state, |seeds| {
        invoke_signed(&ix, &[vault.clone(), mint.clone(), policy.clone(), token.clone()], seeds)
    })
}

/// 3: ApplyPending { expected_counter u64, new_decryptable PodAeCiphertext }
/// accounts: spender (s), policy, vault token (w), token program
fn apply_pending(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let it = &mut accounts.iter();
    let (spender, policy, vault, token) = (
        next_account_info(it)?, next_account_info(it)?, next_account_info(it)?, next_account_info(it)?,
    );
    let state = load_policy(program_id, spender, policy)?;
    let mut at = 0;
    let counter: u64 = read(data, &mut at)?;
    let new_decryptable: PodAeCiphertext = read(data, &mut at)?;
    let ix = ct_ix::apply_pending_balance(token.key, vault.key, counter, &new_decryptable, policy.key, &[])?;
    signed(&state, |seeds| invoke_signed(&ix, &[vault.clone(), policy.clone(), token.clone()], seeds))
}

/// 4: Pay { enforce_limits u8, new_decryptable PodAeCiphertext, auditor_lo, auditor_hi }
/// accounts: spender (s), policy (w), vault token (w), mint, destination token (w),
///   transfer equality ctx, transfer validity ctx, transfer range ctx,
///   policy max-equality ctx, policy daily-equality ctx, policy range ctx, token program
fn pay(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let it = &mut accounts.iter();
    let spender = next_account_info(it)?;
    let policy = next_account_info(it)?;
    let vault = next_account_info(it)?;
    let mint = next_account_info(it)?;
    let destination = next_account_info(it)?;
    let (eq_ctx, validity_ctx, range_ctx) =
        (next_account_info(it)?, next_account_info(it)?, next_account_info(it)?);
    let policy_ctxs = [next_account_info(it)?, next_account_info(it)?, next_account_info(it)?];
    let token = next_account_info(it)?;
    let mut state = load_policy(program_id, spender, policy)?;
    let mut at = 0;
    let enforce_limits: u8 = read(data, &mut at)?;
    let new_decryptable: PodAeCiphertext = read(data, &mut at)?;
    let auditor_lo: PodElGamalCiphertext = read(data, &mut at)?;
    let auditor_hi: PodElGamalCiphertext = read(data, &mut at)?;

    // Allowlist: recipients stay public in confidential transfers, so this is unchanged.
    let recipient_owner = Pubkey::new_from_array(
        destination.data.borrow()[32..64].try_into().map_err(|_| err("bad destination"))?,
    );
    if !state.allowlist[..state.allowlist_count as usize].contains(&recipient_owner) {
        return Err(err("recipient not allowed"));
    }

    if enforce_limits == 1 {
        enforce_encrypted_limits(&mut state, vault, validity_ctx, &policy_ctxs)?;
        policy.data.borrow_mut().copy_from_slice(bytemuck::bytes_of(&state));
    }

    let ix = ct_ix::inner_transfer(
        token.key, vault.key, mint.key, destination.key, &new_decryptable, &auditor_lo, &auditor_hi,
        policy.key, &[],
        ProofLocation::ContextStateAccount(eq_ctx.key),
        ProofLocation::ContextStateAccount(validity_ctx.key),
        ProofLocation::ContextStateAccount(range_ctx.key),
    )?;
    signed(&state, |seeds| {
        invoke_signed(
            &ix,
            &[vault.clone(), mint.clone(), destination.clone(), eq_ctx.clone(), validity_ctx.clone(),
              range_ctx.clone(), policy.clone(), token.clone()],
            seeds,
        )
    })
}

fn enforce_encrypted_limits(
    state: &mut Policy,
    vault: &AccountInfo,
    validity_ctx: &AccountInfo,
    policy_ctxs: &[&AccountInfo; 3],
) -> ProgramResult {
    // The vault's ElGamal pubkey, as registered in its token account.
    let vault_pubkey = {
        let data = vault.data.borrow();
        let account = StateWithExtensions::<spl_token_2022_interface::state::Account>::unpack(&data)?;
        account.get_extension::<ConfidentialTransferAccount>()?.elgamal_pubkey
    };

    // The transfer amount, encrypted under the source (vault) key, from the *same* validity
    // context the token CPI below consumes. Handle index 0 = source.
    let validity: BatchedGroupedCiphertext3HandlesValidityProofContext =
        verify_and_extract_context::<BatchedGroupedCiphertext3HandlesValidityProofData, _>(
            &mut [validity_ctx.clone()].iter(), 0, None,
        )?;
    if validity.first_pubkey != vault_pubkey {
        return Err(err("validity proof is not for the vault key"));
    }
    let amount_lo = validity.grouped_ciphertext_lo.try_extract_ciphertext(0).map_err(|_| err("lo"))?;
    let amount_hi = validity.grouped_ciphertext_hi.try_extract_ciphertext(0).map_err(|_| err("hi"))?;

    // Rolling window, as in zero_policy: reset the encrypted total to Enc(0) = all-zero bytes.
    let now = Clock::get()?.unix_timestamp;
    if now - state.window_start >= WINDOW_SECONDS {
        state.window_start = now;
        state.spent_ciphertext = PodElGamalCiphertext::zeroed();
    }

    let zero = PodElGamalCiphertext::zeroed();
    let max = arith::add_to(&zero, state.max_per_payment).ok_or_else(|| err("max"))?;
    let max_diff = arith::subtract_with_lo_hi(&max, &amount_lo, &amount_hi).ok_or_else(|| err("max diff"))?;
    let new_total = arith::add_with_lo_hi(&state.spent_ciphertext, &amount_lo, &amount_hi)
        .ok_or_else(|| err("total"))?;
    let daily = arith::add_to(&zero, state.daily_limit).ok_or_else(|| err("daily"))?;
    let remaining = arith::subtract(&daily, &new_total).ok_or_else(|| err("remaining"))?;

    let [max_eq_ctx, daily_eq_ctx, range_ctx] = policy_ctxs;
    let max_eq: CiphertextCommitmentEqualityProofContext =
        verify_and_extract_context::<CiphertextCommitmentEqualityProofData, _>(
            &mut [(*max_eq_ctx).clone()].iter(), 0, None,
        )?;
    let daily_eq: CiphertextCommitmentEqualityProofContext =
        verify_and_extract_context::<CiphertextCommitmentEqualityProofData, _>(
            &mut [(*daily_eq_ctx).clone()].iter(), 0, None,
        )?;
    let range: BatchedRangeProofContext =
        verify_and_extract_context::<BatchedRangeProofU128Data, _>(&mut [(*range_ctx).clone()].iter(), 0, None)?;

    if max_eq.pubkey != vault_pubkey || daily_eq.pubkey != vault_pubkey {
        return Err(err("policy proofs are not for the vault key"));
    }
    if max_eq.ciphertext != max_diff {
        return Err(err("max_per_payment proof is for a different amount"));
    }
    if daily_eq.ciphertext != remaining {
        return Err(err("daily_limit proof is for a different total"));
    }
    if range.commitments[0] != max_eq.commitment
        || range.commitments[1] != daily_eq.commitment
        || range.bit_lengths[0] != 64
        || range.bit_lengths[1] != 64
    {
        return Err(err("range proof does not cover the policy commitments"));
    }
    state.spent_ciphertext = new_total;
    Ok(())
}
