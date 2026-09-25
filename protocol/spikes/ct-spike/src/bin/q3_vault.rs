//! Q3 + Q4: a PDA-owned confidential vault (spikes/ct-vault) paying confidentially via CPI, with
//! max_per_payment and daily_limit enforced on the *encrypted* amount.
//!
//! Policy: max $5 per payment, $6 per rolling day, allowlist = [data.api].
//! Honest payments: $0.42, then $5 (total $5.42).
//! Then attacks: over the daily limit, over max, a lying equality proof, a proof for a different
//! amount, a non-allowlisted recipient, the spender calling Token-2022 directly, and finally a
//! payment with enforcement switched off (to show what the key holder could do without Q4).

use {
    ct_spike::*,
    ct_vault::{policy_address, Policy, MAX_PROVIDERS},
    solana_address::Address,
    solana_instruction::{AccountMeta, Instruction},
    solana_keypair::Keypair,
    solana_signer::Signer,
    solana_zk_elgamal_proof_interface::instruction::{close_context_state, ContextStateInfo, ProofInstruction},
    solana_zk_sdk::{
        encryption::{
            auth_encryption::AeKey,
            elgamal::{ElGamalCiphertext, ElGamalKeypair},
            pedersen::Pedersen,
        },
        zk_elgamal_proof_program::{
            batched_range_proof::batched_range_proof_u128::build_batched_range_proof_u128_data,
            ciphertext_commitment_equality::build_ciphertext_commitment_equality_proof_data,
            build_pubkey_validity_proof_data,
        },
    },
    solana_zk_sdk_pod::encryption::elgamal::PodElGamalCiphertext,
    spl_token_2022_interface::{
        extension::{confidential_transfer::instruction as ct_ix, ExtensionType},
        id as token_2022,
        instruction as token_ix,
    },
    spl_token_confidential_transfer_ciphertext_arithmetic as arith,
    spl_token_confidential_transfer_proof_extraction::instruction::ProofLocation,
    spl_token_confidential_transfer_proof_generation::transfer::transfer_split_proof_data,
    std::{num::NonZeroI8, str::FromStr},
};

const VAULT_PROGRAM: &str = "AYDFEPAC4vyXZW4MpTxLA5DA1zwKdqqEX19UJoiEVTHa";
const DECIMALS: u8 = 6;
const MAX: u64 = 5_000_000;
const DAILY: u64 = 6_000_000;

struct Party {
    owner: Keypair,
    token: Keypair,
    elgamal: ElGamalKeypair,
    aes: AeKey,
}

/// How the client builds the two policy statements for a payment.
#[derive(Clone, Copy, PartialEq, Debug)]
enum PolicyProofs {
    /// Honest: real values; refuses locally if a limit would be exceeded.
    Honest,
    /// Claims both differences are 0 regardless of the truth (a forged equality proof).
    Lie,
    /// Proves the policy for `$0.10` while transferring the real amount.
    ForOtherAmount,
    /// No policy proofs at all; Pay is sent with enforcement off.
    Off,
}

struct World {
    ctx: Ctx,
    program: Address,
    mint: Keypair,
    auditor: ElGamalKeypair,
    spender: Keypair,
    policy: Address,
    vault: Keypair,
    vault_keys: (ElGamalKeypair, AeKey),
    spent: u64, // what the spender (key holder) knows the encrypted total to be
}

fn main() {
    let ctx = Ctx::new();
    let program = Address::from_str(VAULT_PROGRAM).unwrap();
    assert!(ctx.account_exists(&program), "ct-vault not deployed; start localnet.sh with SPIKE_PROGRAMS");
    let spender = Keypair::new();
    let (policy, _) = policy_address(&program, &spender.pubkey());
    let mut w = World {
        ctx,
        program,
        mint: Keypair::new(),
        auditor: ElGamalKeypair::new_rand(),
        spender,
        policy,
        vault: Keypair::new(),
        vault_keys: (ElGamalKeypair::new_rand(), AeKey::new_rand()),
        spent: 0,
    };
    println!("program {}  policy PDA {}  vault token {}", w.program, w.policy, w.vault.pubkey());

    println!("\n[setup]");
    create_mint(&mut w);
    let data_api = party(&mut w, "data.api");
    let unknown_api = party(&mut w, "unknown.api");
    init_policy(&mut w, &[data_api.owner.pubkey()]);
    create_vault(&mut w);

    println!("\n[Q3: the program pays confidentially via CPI; limits enforced on encrypted amounts]");
    report(pay(&mut w, &data_api, 420_000, PolicyProofs::Honest), "pay $0.42 -> data.api");
    report(pay(&mut w, &data_api, 5_000_000, PolicyProofs::Honest), "pay $5.00 -> data.api");

    println!("\n[Q4: violations]");
    report(pay(&mut w, &data_api, 1_000_000, PolicyProofs::Honest), "pay $1.00 (total would be $6.42 > $6 daily), honest client");
    report(pay(&mut w, &data_api, 1_000_000, PolicyProofs::Lie), "pay $1.00 with a forged 'remaining >= 0' proof");
    report(pay(&mut w, &data_api, 6_000_000, PolicyProofs::Honest), "pay $6.00 (> $5 max), honest client");
    report(pay(&mut w, &data_api, 6_000_000, PolicyProofs::ForOtherAmount), "pay $6.00 with policy proofs made for $0.10");
    report(pay(&mut w, &unknown_api, 100_000, PolicyProofs::Honest), "pay $0.10 -> unknown.api (not allowlisted)");
    report(direct_token_transfer(&mut w, &data_api), "spender calls Token-2022 transfer directly (bypassing program)");

    println!("\n[concurrency: two payments built from the same vault state]");
    let before = w.ctx.ct_account(&w.vault.pubkey());
    report(pay(&mut w, &data_api, 100_000, PolicyProofs::Honest), "pay $0.10 (first)");
    report(pay_from(&mut w, &data_api, 100_000, PolicyProofs::Honest, Some(before)),
        "pay $0.10 (second, proofs built from the state before the first payment)");

    println!("\n[what the key holder could do without Q4 proofs]");
    report(pay(&mut w, &data_api, 6_000_000, PolicyProofs::Off), "pay $6.00 with enforce_limits = 0");

    println!("\n[who can decrypt what]");
    let account = w.ctx.ct_account(&w.vault.pubkey());
    let balance: ElGamalCiphertext = account.available_balance.try_into().unwrap();
    println!("  vault balance, decrypted by the vault key holder (spender): {:?} (AES fast path: {})",
        w.vault_keys.0.secret().decrypt_u32(&balance), decrypt_available(&account, &w.vault_keys.1));
    println!("  vault balance, decrypted with the auditor key: {:?}", w.auditor.secret().decrypt_u32(&balance));
    let state: Policy = bytemuck::pod_read_unaligned(&w.ctx.account_data(&w.policy));
    let total: ElGamalCiphertext = state.spent_ciphertext.try_into().unwrap();
    println!("  policy's encrypted daily total, decrypted by the vault key holder: {:?}",
        w.vault_keys.0.secret().decrypt_u32(&total));
    println!("  policy's encrypted daily total, decrypted with the auditor key: {:?}",
        w.auditor.secret().decrypt_u32(&total));
    println!("  public (plaintext) policy fields: max={} daily={} window_start={} allowlist[0]={}",
        state.max_per_payment, state.daily_limit, state.window_start, state.allowlist[0]);
}

fn report(result: Result<String, String>, what: &str) {
    match result {
        Ok(detail) => println!("  OK       {what}: {detail}"),
        Err(detail) => println!("  REJECTED {what}: {detail}"),
    }
}

fn create_mint(w: &mut World) {
    let space = mint_len(&[ExtensionType::ConfidentialTransferMint]);
    let ixs = [
        w.ctx.create_account_ix(&w.mint.pubkey(), space, &token_2022()),
        ct_ix::initialize_mint(&token_2022(), &w.mint.pubkey(), Some(w.ctx.payer.pubkey()), true, Some((*w.auditor.pubkey()).into())).unwrap(),
        token_ix::initialize_mint2(&token_2022(), &w.mint.pubkey(), &w.ctx.payer.pubkey(), None, DECIMALS).unwrap(),
    ];
    w.ctx.send("create CT mint with auditor", &ixs, &[&w.mint]);
}

fn party(w: &mut World, name: &str) -> Party {
    let p = Party { owner: Keypair::new(), token: Keypair::new(), elgamal: ElGamalKeypair::new_rand(), aes: AeKey::new_rand() };
    let proof = build_pubkey_validity_proof_data(&p.elgamal).unwrap();
    let mut ixs = vec![
        w.ctx.create_account_ix(&p.token.pubkey(), account_len(&[ExtensionType::ConfidentialTransferAccount]), &token_2022()),
        token_ix::initialize_account3(&token_2022(), &p.token.pubkey(), &w.mint.pubkey(), &p.owner.pubkey()).unwrap(),
    ];
    ixs.extend(ct_ix::configure_account(&token_2022(), &p.token.pubkey(), &w.mint.pubkey(), &p.aes.encrypt(0).into(), 65536,
        &p.owner.pubkey(), &[], ProofLocation::InstructionOffset(NonZeroI8::new(1).unwrap(), &proof)).unwrap());
    w.ctx.send(&format!("create+configure {name} CT account"), &ixs, &[&p.token, &p.owner]);
    p
}

fn program_ix(w: &World, data: Vec<u8>, accounts: Vec<AccountMeta>) -> Instruction {
    Instruction { program_id: w.program, accounts, data }
}

fn init_policy(w: &mut World, allowed: &[Address]) {
    let mut list = [Address::default(); MAX_PROVIDERS];
    list[..allowed.len()].copy_from_slice(allowed);
    let mut data = vec![0u8];
    data.extend_from_slice(&MAX.to_le_bytes());
    data.extend_from_slice(&DAILY.to_le_bytes());
    data.push(allowed.len() as u8);
    data.extend_from_slice(bytemuck::bytes_of(&list));
    let ix = program_ix(w, data, vec![
        AccountMeta::new(w.spender.pubkey(), true),
        AccountMeta::new(w.policy, false),
        AccountMeta::new_readonly(solana_system_interface::program::ID, false),
    ]);
    // The spender pays the policy's rent here, so fund it first.
    let fund = solana_system_interface::instruction::transfer(&w.ctx.payer.pubkey(), &w.spender.pubkey(), 1_000_000_000);
    let signer = w.spender.insecure_clone();
    w.ctx.send("init policy (max $5, daily $6, allowlist)", &[fund, ix], &[&signer]);
}

fn create_vault(w: &mut World) {
    let vault = w.vault.insecure_clone();
    let spender = w.spender.insecure_clone();
    // Token account whose owner/authority is the policy PDA.
    let ixs = [
        w.ctx.create_account_ix(&vault.pubkey(), account_len(&[ExtensionType::ConfidentialTransferAccount]), &token_2022()),
        token_ix::initialize_account3(&token_2022(), &vault.pubkey(), &w.mint.pubkey(), &w.policy).unwrap(),
    ];
    w.ctx.send("create vault token account (owner = policy PDA)", &ixs, &[&vault]);

    // The vault's ElGamal key is held off-chain by the spender: it proves knowledge of the key into
    // a context account, and the program configures the account via CPI (PDA signs).
    let validity = build_pubkey_validity_proof_data(&w.vault_keys.0).unwrap();
    let ctx_kp = Keypair::new();
    verify_into_context(&mut w.ctx, "vault pubkey validity", ProofInstruction::VerifyPubkeyValidity, &validity, &ctx_kp, &spender, None);
    let mut data = vec![1u8];
    data.extend_from_slice(bytemuck::bytes_of(&solana_zk_sdk_pod::encryption::auth_encryption::PodAeCiphertext::from(w.vault_keys.1.encrypt(0))));
    data.extend_from_slice(&65536u64.to_le_bytes());
    let configure = program_ix(w, data, vec![
        AccountMeta::new_readonly(spender.pubkey(), true),
        AccountMeta::new_readonly(w.policy, false),
        AccountMeta::new(vault.pubkey(), false),
        AccountMeta::new_readonly(w.mint.pubkey(), false),
        AccountMeta::new_readonly(ctx_kp.pubkey(), false),
        AccountMeta::new_readonly(token_2022(), false),
    ]);
    let close = close_context_state(ContextStateInfo { context_state_account: &ctx_kp.pubkey(), context_state_authority: &spender.pubkey() }, &w.ctx.payer.pubkey());
    w.ctx.send("program CPI: configure vault for CT (PDA signs)", &[configure, close], &[&spender]);

    // Fund: $100 public -> vault, then program CPIs deposit + apply pending.
    let mint_to = token_ix::mint_to(&token_2022(), &w.mint.pubkey(), &vault.pubkey(), &w.ctx.payer.pubkey(), &[], 100_000_000).unwrap();
    w.ctx.send("mint $100 public to vault", &[mint_to], &[]);
    let mut data = vec![2u8];
    data.extend_from_slice(&100_000_000u64.to_le_bytes());
    data.push(DECIMALS);
    let deposit = program_ix(w, data, vec![
        AccountMeta::new_readonly(spender.pubkey(), true),
        AccountMeta::new_readonly(w.policy, false),
        AccountMeta::new(vault.pubkey(), false),
        AccountMeta::new_readonly(w.mint.pubkey(), false),
        AccountMeta::new_readonly(token_2022(), false),
    ]);
    w.ctx.send("program CPI: deposit $100 -> pending", &[deposit], &[&spender]);
    let account = w.ctx.ct_account(&vault.pubkey());
    let pending = decrypt_pending(&account, w.vault_keys.0.secret());
    let counter: u64 = account.pending_balance_credit_counter.into();
    let mut data = vec![3u8];
    data.extend_from_slice(&counter.to_le_bytes());
    data.extend_from_slice(bytemuck::bytes_of(&solana_zk_sdk_pod::encryption::auth_encryption::PodAeCiphertext::from(
        w.vault_keys.1.encrypt(decrypt_available(&account, &w.vault_keys.1) + pending))));
    let apply = program_ix(w, data, vec![
        AccountMeta::new_readonly(spender.pubkey(), true),
        AccountMeta::new_readonly(w.policy, false),
        AccountMeta::new(vault.pubkey(), false),
        AccountMeta::new_readonly(token_2022(), false),
    ]);
    w.ctx.send("program CPI: apply pending", &[apply], &[&spender]);
}

/// One payment from the vault. Returns a summary on success, the failure reason otherwise.
fn pay(w: &mut World, to: &Party, amount: u64, mode: PolicyProofs) -> Result<String, String> {
    pay_from(w, to, amount, mode, None)
}

/// `snapshot`: build the transfer proofs against this (possibly stale) vault state instead of
/// the current one.
fn pay_from(
    w: &mut World,
    to: &Party,
    amount: u64,
    mode: PolicyProofs,
    snapshot: Option<spl_token_2022_interface::extension::confidential_transfer::ConfidentialTransferAccount>,
) -> Result<String, String> {
    let started = std::time::Instant::now();
    let spender = w.spender.insecure_clone();
    let (vault_elgamal, vault_aes) = (&w.vault_keys.0, &w.vault_keys.1);
    let account = snapshot.unwrap_or_else(|| w.ctx.ct_account(&w.vault.pubkey()));
    let available = decrypt_available(&account, vault_aes);

    // --- policy statements (computed before any transaction, like zero's check()) ------------
    // Window: the program resets when now - window_start >= 1 day; this run stays inside a day,
    // except for the very first payment (window_start = 0).
    let state: Policy = bytemuck::pod_read_unaligned(&w.ctx.account_data(&w.policy));
    let (spent_ct, spent) = if state.window_start == 0 {
        (PodElGamalCiphertext::default(), 0)
    } else {
        (state.spent_ciphertext, w.spent)
    };
    let max_value = MAX as i128 - amount as i128;
    let remaining_value = DAILY as i128 - (spent + amount) as i128;
    if mode == PolicyProofs::Honest && (max_value < 0 || remaining_value < 0) {
        return Err(format!(
            "refused locally before sending: max-amount={} daily-(total+amount)={} (no 64-bit range proof exists for a negative value)",
            max_value, remaining_value
        ));
    }

    // --- transfer proofs ------------------------------------------------------------------------
    let (proofs, t_transfer) = timed(|| transfer_split_proof_data(
        &available_ciphertext(&account), &decryptable_available(&account), amount,
        vault_elgamal, vault_aes, to.elgamal.pubkey(), Some(w.auditor.pubkey()),
    ).map_err(|e| format!("transfer proof generation: {e:?}")));
    let proofs = proofs?;
    let validity = &proofs.ciphertext_validity_proof_data_with_ciphertext;
    let lo = validity.proof_data.context.grouped_ciphertext_lo.try_extract_ciphertext(0).unwrap();
    let hi = validity.proof_data.context.grouped_ciphertext_hi.try_extract_ciphertext(0).unwrap();

    let before = w.ctx.stats.len();
    let (eq, val, range, record) = (Keypair::new(), Keypair::new(), Keypair::new(), Keypair::new());
    verify_into_context(&mut w.ctx, "transfer equality", ProofInstruction::VerifyCiphertextCommitmentEquality, &proofs.equality_proof_data, &eq, &spender, None);
    verify_into_context(&mut w.ctx, "transfer validity", ProofInstruction::VerifyBatchedGroupedCiphertext3HandlesValidity, &validity.proof_data, &val, &spender, None);
    verify_into_context(&mut w.ctx, "transfer range", ProofInstruction::VerifyBatchedRangeProofU128, &proofs.range_proof_data, &range, &spender, Some(&record));

    // --- policy proofs --------------------------------------------------------------------------
    let (peq_max, peq_daily, prange, precord) = (Keypair::new(), Keypair::new(), Keypair::new(), Keypair::new());
    let mut policy_time = std::time::Duration::ZERO;
    if mode != PolicyProofs::Off {
        let zero = PodElGamalCiphertext::default();
        let proved_amount_cts = if mode == PolicyProofs::ForOtherAmount {
            // A genuine encryption of $0.10 under the vault key, used to build the proofs.
            let fake = vault_elgamal.pubkey().encrypt(100_000u64);
            let fake: PodElGamalCiphertext = fake.into();
            (fake, zero)
        } else {
            (lo, hi)
        };
        let max_diff = arith::subtract_with_lo_hi(&arith::add_to(&zero, MAX).unwrap(), &proved_amount_cts.0, &proved_amount_cts.1).unwrap();
        let new_total = arith::add_with_lo_hi(&spent_ct, &proved_amount_cts.0, &proved_amount_cts.1).unwrap();
        let remaining = arith::subtract(&arith::add_to(&zero, DAILY).unwrap(), &new_total).unwrap();
        let (v_max, v_rem) = match mode {
            PolicyProofs::Lie => (0u64, 0u64),
            PolicyProofs::ForOtherAmount => (MAX - 100_000, DAILY - (spent + 100_000)),
            _ => (max_value as u64, remaining_value as u64),
        };
        let ((eq_max, eq_rem, range_data), t) = timed(|| {
            let (c1, o1) = Pedersen::new(v_max);
            let (c2, o2) = Pedersen::new(v_rem);
            let ct1: ElGamalCiphertext = max_diff.try_into().unwrap();
            let ct2: ElGamalCiphertext = remaining.try_into().unwrap();
            let eq = |ct: &ElGamalCiphertext, c, o, v: u64, real: PodElGamalCiphertext| {
                if mode == PolicyProofs::Lie {
                    // The honest builder refuses to prove a false statement (InconsistentInput),
                    // so forge one: prove Enc(0) = commit(0), then swap in the real ciphertext.
                    let decoy = vault_elgamal.pubkey().encrypt(0u64);
                    let mut data = build_ciphertext_commitment_equality_proof_data(vault_elgamal, &decoy, c, o, 0).unwrap();
                    data.context.ciphertext = real;
                    data
                } else {
                    build_ciphertext_commitment_equality_proof_data(vault_elgamal, ct, c, o, v).unwrap()
                }
            };
            (
                eq(&ct1, &c1, &o1, v_max, max_diff),
                eq(&ct2, &c2, &o2, v_rem, remaining),
                build_batched_range_proof_u128_data(vec![&c1, &c2], vec![v_max, v_rem], vec![64, 64], vec![&o1, &o2]).unwrap(),
            )
        });
        policy_time = t;
        let label = |s: &str| format!("policy {s}");
        let r1 = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            verify_into_context(&mut w.ctx, &label("max equality"), ProofInstruction::VerifyCiphertextCommitmentEquality, &eq_max, &peq_max, &spender, None);
        }));
        if r1.is_err() {
            let close: Vec<_> = [&eq, &val, &range].iter().map(|k| close_context_state(
                ContextStateInfo { context_state_account: &k.pubkey(), context_state_authority: &spender.pubkey() }, &w.ctx.payer.pubkey()))
                .chain([spl_record::instruction::close_account(&record.pubkey(), &spender.pubkey(), &w.ctx.payer.pubkey())]).collect();
            w.ctx.send("close contexts/records", &close, &[&spender]);
            return Err("the ZK ElGamal proof program rejected the forged policy equality proof: \
                        'proof verification failed: SigmaProof(Equality, AlgebraicRelation)'".into());
        }
        verify_into_context(&mut w.ctx, &label("daily equality"), ProofInstruction::VerifyCiphertextCommitmentEquality, &eq_rem, &peq_daily, &spender, None);
        verify_into_context(&mut w.ctx, &label("range (2 x 64 bit)"), ProofInstruction::VerifyBatchedRangeProofU128, &range_data, &prange, &spender, Some(&precord));
    }

    // --- Pay (program CPI) ----------------------------------------------------------------------
    let new_decryptable = solana_zk_sdk_pod::encryption::auth_encryption::PodAeCiphertext::from(vault_aes.encrypt(available - amount));
    let mut data = vec![4u8, if mode == PolicyProofs::Off { 0 } else { 1 }];
    data.extend_from_slice(bytemuck::bytes_of(&new_decryptable));
    data.extend_from_slice(bytemuck::bytes_of(&validity.ciphertext_lo));
    data.extend_from_slice(bytemuck::bytes_of(&validity.ciphertext_hi));
    let pay_ix = program_ix(w, data, vec![
        AccountMeta::new_readonly(spender.pubkey(), true),
        AccountMeta::new(w.policy, false),
        AccountMeta::new(w.vault.pubkey(), false),
        AccountMeta::new_readonly(w.mint.pubkey(), false),
        AccountMeta::new(to.token.pubkey(), false),
        AccountMeta::new_readonly(eq.pubkey(), false),
        AccountMeta::new_readonly(val.pubkey(), false),
        AccountMeta::new_readonly(range.pubkey(), false),
        AccountMeta::new_readonly(if mode == PolicyProofs::Off { eq.pubkey() } else { peq_max.pubkey() }, false),
        AccountMeta::new_readonly(if mode == PolicyProofs::Off { eq.pubkey() } else { peq_daily.pubkey() }, false),
        AccountMeta::new_readonly(if mode == PolicyProofs::Off { eq.pubkey() } else { prange.pubkey() }, false),
        AccountMeta::new_readonly(token_2022(), false),
    ]);
    let result = w.ctx.try_send(&format!("Pay ${} via program CPI", amount as f64 / 1e6), &[pay_ix], &[&spender]);
    let elapsed = started.elapsed();

    // Clean up context and record accounts (rent back to payer), whatever happened.
    let mut close = vec![];
    for k in [&eq, &val, &range, &peq_max, &peq_daily, &prange] {
        if w.ctx.account_exists(&k.pubkey()) {
            close.push(close_context_state(ContextStateInfo { context_state_account: &k.pubkey(), context_state_authority: &spender.pubkey() }, &w.ctx.payer.pubkey()));
        }
    }
    for r in [&record, &precord] {
        if w.ctx.account_exists(&r.pubkey()) {
            close.push(spl_record::instruction::close_account(&r.pubkey(), &spender.pubkey(), &w.ctx.payer.pubkey()));
        }
    }
    for chunk in close.chunks(4) {
        w.ctx.send("close contexts/records", chunk, &[&spender]);
    }

    match result {
        Ok(stat) => {
            if mode != PolicyProofs::Off {
                w.spent += amount;
            }
            let txs = &w.ctx.stats[before..];
            let n_before_close = txs.len() - close.chunks(4).count();
            let cu: u64 = txs[..n_before_close].iter().map(|s| s.compute_units).sum();
            let aud_lo = w.auditor.secret().decrypt_u32(&validity.ciphertext_lo.try_into().unwrap()).unwrap();
            let aud_hi = w.auditor.secret().decrypt_u32(&validity.ciphertext_hi.try_into().unwrap()).unwrap();
            Ok(format!(
                "{} txs before cleanup ({} CU total; Pay itself {} CU, {} B), {:.2}s wall clock sent sequentially, proof gen transfer {:?} + policy {:?}; auditor reads amount {}",
                n_before_close, cu, stat.compute_units, stat.size, elapsed.as_secs_f64(), t_transfer, policy_time, aud_lo + (aud_hi << 16)
            ))
        }
        Err(logs) => Err(logs
            .iter()
            .filter(|l| l.contains("ct-vault:") || l.contains("failed") || l.contains("Error") || l.starts_with("status"))
            .cloned()
            .collect::<Vec<_>>()
            .join(" | ")),
    }
}

/// The spender holds the vault's ElGamal key and can build valid proofs, but the token account's
/// authority is the policy PDA: a direct Token-2022 transfer has no valid signer.
fn direct_token_transfer(w: &mut World, to: &Party) -> Result<String, String> {
    let spender = w.spender.insecure_clone();
    let account = w.ctx.ct_account(&w.vault.pubkey());
    let available = decrypt_available(&account, &w.vault_keys.1);
    let proofs = transfer_split_proof_data(&available_ciphertext(&account), &decryptable_available(&account), 100_000,
        &w.vault_keys.0, &w.vault_keys.1, to.elgamal.pubkey(), Some(w.auditor.pubkey())).unwrap();
    let (eq, val, range, record) = (Keypair::new(), Keypair::new(), Keypair::new(), Keypair::new());
    let v = &proofs.ciphertext_validity_proof_data_with_ciphertext;
    verify_into_context(&mut w.ctx, "equality", ProofInstruction::VerifyCiphertextCommitmentEquality, &proofs.equality_proof_data, &eq, &spender, None);
    verify_into_context(&mut w.ctx, "validity", ProofInstruction::VerifyBatchedGroupedCiphertext3HandlesValidity, &v.proof_data, &val, &spender, None);
    verify_into_context(&mut w.ctx, "range", ProofInstruction::VerifyBatchedRangeProofU128, &proofs.range_proof_data, &range, &spender, Some(&record));
    let (eqk, valk, rangek) = (eq.pubkey(), val.pubkey(), range.pubkey());
    // Try with the spender as authority (it is not the owner) ...
    let ixs = ct_ix::transfer(&token_2022(), &w.vault.pubkey(), &w.mint.pubkey(), &to.token.pubkey(),
        &w.vault_keys.1.encrypt(available - 100_000).into(), &v.ciphertext_lo, &v.ciphertext_hi, &spender.pubkey(), &[],
        ProofLocation::ContextStateAccount(&eqk), ProofLocation::ContextStateAccount(&valk), ProofLocation::ContextStateAccount(&rangek)).unwrap();
    let as_spender = w.ctx.try_send("direct transfer, authority = spender", &ixs, &[&spender]);
    // ... and naming the PDA as authority (nobody can produce its signature off-chain).
    let mut ixs = ct_ix::transfer(&token_2022(), &w.vault.pubkey(), &w.mint.pubkey(), &to.token.pubkey(),
        &w.vault_keys.1.encrypt(available - 100_000).into(), &v.ciphertext_lo, &v.ciphertext_hi, &w.policy, &[],
        ProofLocation::ContextStateAccount(&eqk), ProofLocation::ContextStateAccount(&valk), ProofLocation::ContextStateAccount(&rangek)).unwrap();
    for m in ixs[0].accounts.iter_mut() {
        if m.pubkey == w.policy { m.is_signer = false; }
    }
    let as_pda = w.ctx.try_send("direct transfer, authority = policy PDA (unsigned)", &ixs, &[]);
    let close: Vec<_> = [&eq, &val, &range].iter().map(|k| close_context_state(
        ContextStateInfo { context_state_account: &k.pubkey(), context_state_authority: &spender.pubkey() }, &w.ctx.payer.pubkey())).chain(
        [spl_record::instruction::close_account(&record.pubkey(), &spender.pubkey(), &w.ctx.payer.pubkey())]).collect();
    w.ctx.send("close contexts/records", &close, &[&spender]);
    let pick = |r: Result<TxStat, Vec<String>>| match r {
        Ok(_) => "SUCCEEDED (bad)".to_string(),
        Err(logs) => logs.iter().filter(|l| l.contains("rror") || l.contains("failed") || l.contains("status")).cloned().collect::<Vec<_>>().join(" | "),
    };
    let (a, b) = (pick(as_spender), pick(as_pda));
    if a.contains("SUCCEEDED") || b.contains("SUCCEEDED") {
        Ok(format!("spender: {a}; pda: {b}"))
    } else {
        Err(format!("as spender: {a} || as PDA: {b}"))
    }
}
