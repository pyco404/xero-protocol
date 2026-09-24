//! Q2: a full Token-2022 confidential transfer on localnet, measured.
//!
//! mint (6 decimals, auditor key) -> alice + bob configure -> mint 1000 public to alice
//! -> alice deposit 100 -> apply pending -> alice sends 0.42 confidentially to bob
//! -> bob apply pending -> bob withdraws 0.42 back to public.
//!
//! Prints each transaction's size / CU / fee, proof-generation times, what an observer sees,
//! and what the auditor can decrypt. Writes the raw observer views to out/.

use {
    ct_spike::*,
    serde_json::json,
    solana_keypair::Keypair,
    solana_signer::Signer,
    solana_zk_elgamal_proof_interface::{
        instruction::{close_context_state, ContextStateInfo, ProofInstruction},
        proof_data::{
            BatchedGroupedCiphertext3HandlesValidityProofContext, BatchedRangeProofContext,
            CiphertextCommitmentEqualityProofContext,
        },
        state::ProofContextState,
    },
    solana_zk_sdk::{
        encryption::{auth_encryption::AeKey, elgamal::ElGamalKeypair},
        zk_elgamal_proof_program::build_pubkey_validity_proof_data,
    },
    spl_token_2022_interface::{
        extension::{confidential_transfer::instruction as ct_ix, ExtensionType},
        id as token_2022,
        instruction as token_ix,
    },
    spl_token_confidential_transfer_proof_extraction::instruction::ProofLocation,
    spl_token_confidential_transfer_proof_generation::{
        transfer::transfer_split_proof_data, withdraw::withdraw_proof_data,
    },
    std::{fs, mem::size_of, num::NonZeroI8},
};

const DECIMALS: u8 = 6;
const TRANSFER: u64 = 420_000; // $0.42

struct Party {
    owner: Keypair,
    token: Keypair,
    elgamal: ElGamalKeypair,
    aes: AeKey,
}

fn main() {
    let mut ctx = Ctx::new();
    fs::create_dir_all("out").unwrap();
    let auditor = ElGamalKeypair::new_rand();
    let mint = Keypair::new();
    let alice = party();
    let bob = party();
    println!("mint {}  alice {}  bob {}", mint.pubkey(), alice.token.pubkey(), bob.token.pubkey());

    // ---- setup -----------------------------------------------------------------------------
    println!("\n[setup]");
    let space = mint_len(&[ExtensionType::ConfidentialTransferMint]);
    ctx.send(
        "create mint (ConfidentialTransferMint+auditor)",
        &[
            ctx.create_account_ix(&mint.pubkey(), space, &token_2022()),
            ct_ix::initialize_mint(
                &token_2022(),
                &mint.pubkey(),
                Some(ctx.payer.pubkey()),
                true, // auto-approve accounts
                Some((*auditor.pubkey()).into()),
            )
            .unwrap(),
            token_ix::initialize_mint2(&token_2022(), &mint.pubkey(), &ctx.payer.pubkey(), None, DECIMALS)
                .unwrap(),
        ],
        &[&mint],
    );
    for (name, p) in [("alice", &alice), ("bob", &bob)] {
        let (proof, t) = timed(|| build_pubkey_validity_proof_data(&p.elgamal).unwrap());
        println!("  proof: pubkey validity ({name}) {:?}", t);
        let space = account_len(&[ExtensionType::ConfidentialTransferAccount]);
        let mut ixs = vec![
            ctx.create_account_ix(&p.token.pubkey(), space, &token_2022()),
            token_ix::initialize_account3(&token_2022(), &p.token.pubkey(), &mint.pubkey(), &p.owner.pubkey())
                .unwrap(),
        ];
        // configure_account puts the proof instruction right after itself (offset 1).
        ixs.extend(
            ct_ix::configure_account(
                &token_2022(),
                &p.token.pubkey(),
                &mint.pubkey(),
                &p.aes.encrypt(0).into(),
                65536,
                &p.owner.pubkey(),
                &[],
                ProofLocation::InstructionOffset(NonZeroI8::new(1).unwrap(), &proof),
            )
            .unwrap(),
        );
        ctx.send(&format!("create+configure CT account ({name})"), &ixs, &[&p.token, &p.owner]);
    }
    ctx.send(
        "mint_to alice 1000 (public)",
        &[token_ix::mint_to(&token_2022(), &mint.pubkey(), &alice.token.pubkey(), &ctx.payer.pubkey(), &[], 1_000_000_000).unwrap()],
        &[],
    );

    // ---- deposit + apply ---------------------------------------------------------------------
    println!("\n[deposit public -> confidential]");
    let deposit = ctx.send(
        "deposit 100 (alice)",
        &[ct_ix::deposit(&token_2022(), &alice.token.pubkey(), &mint.pubkey(), 100_000_000, DECIMALS, &alice.owner.pubkey(), &[]).unwrap()],
        &[&alice.owner],
    );
    apply_pending(&mut ctx, &alice, "alice");

    // ---- confidential transfer ------------------------------------------------------------
    println!("\n[confidential transfer alice -> bob, $0.42]");
    let account = ctx.ct_account(&alice.token.pubkey());
    let (proofs, proof_time) = timed(|| {
        transfer_split_proof_data(
            &available_ciphertext(&account),
            &decryptable_available(&account),
            TRANSFER,
            &alice.elgamal,
            &alice.aes,
            bob.elgamal.pubkey(),
            Some(auditor.pubkey()),
        )
        .unwrap()
    });
    println!("  proof: transfer (equality + 3-handle validity + U128 range) {:?}", proof_time);
    let proof_sizes = [
        size_of::<solana_zk_elgamal_proof_interface::proof_data::CiphertextCommitmentEqualityProofData>(),
        size_of::<solana_zk_elgamal_proof_interface::proof_data::BatchedGroupedCiphertext3HandlesValidityProofData>(),
        size_of::<solana_zk_elgamal_proof_interface::proof_data::BatchedRangeProofU128Data>(),
    ];
    println!("  proof data sizes: equality {} B, validity {} B, range {} B", proof_sizes[0], proof_sizes[1], proof_sizes[2]);

    let new_balance = alice.aes.encrypt(decrypt_available(&account, &alice.aes) - TRANSFER).into();
    let validity = &proofs.ciphertext_validity_proof_data_with_ciphertext;

    // Option A: everything inline in one transaction. Only measured, not sent, if it is too big.
    let inline = ct_ix::transfer(
        &token_2022(),
        &alice.token.pubkey(),
        &mint.pubkey(),
        &bob.token.pubkey(),
        &new_balance,
        &validity.ciphertext_lo,
        &validity.ciphertext_hi,
        &alice.owner.pubkey(),
        &[],
        ProofLocation::InstructionOffset(NonZeroI8::new(1).unwrap(), &proofs.equality_proof_data),
        ProofLocation::InstructionOffset(NonZeroI8::new(2).unwrap(), &validity.proof_data),
        ProofLocation::InstructionOffset(NonZeroI8::new(3).unwrap(), &proofs.range_proof_data),
    )
    .unwrap();
    let inline_size = ctx.tx_size(&inline, &[&alice.owner]);
    println!("  option A (all proofs inline, 1 tx): {inline_size} B vs limit {PACKET_DATA_SIZE} B -> {}",
        if inline_size <= PACKET_DATA_SIZE { "fits" } else { "DOES NOT FIT" });

    // Option B: pre-verify each proof into a context-state account, then transfer.
    let eq_ctx = Keypair::new();
    let val_ctx = Keypair::new();
    let range_ctx = Keypair::new();
    let authority = alice.owner.pubkey();
    let eq_key = eq_ctx.pubkey();
    let val_key = val_ctx.pubkey();
    let range_key = range_ctx.pubkey();
    let zk = solana_zk_elgamal_proof_interface::id();

    let tx_eq = ctx.send(
        "verify equality proof -> context account",
        &[
            ctx.create_account_ix(&eq_key, size_of::<ProofContextState<CiphertextCommitmentEqualityProofContext>>(), &zk),
            ProofInstruction::VerifyCiphertextCommitmentEquality.encode_verify_proof(
                Some(ContextStateInfo { context_state_account: &eq_key, context_state_authority: &authority }),
                &proofs.equality_proof_data,
            ),
        ],
        &[&eq_ctx],
    );
    let tx_val = ctx.send(
        "verify ciphertext-validity proof -> context",
        &[
            ctx.create_account_ix(&val_key, size_of::<ProofContextState<BatchedGroupedCiphertext3HandlesValidityProofContext>>(), &zk),
            ProofInstruction::VerifyBatchedGroupedCiphertext3HandlesValidity.encode_verify_proof(
                Some(ContextStateInfo { context_state_account: &val_key, context_state_authority: &authority }),
                &validity.proof_data,
            ),
        ],
        &[&val_ctx],
    );
    // The U128 range proof (1000 B) does not fit in any transaction on its own, so it goes
    // through an spl-record account: create + write in chunks, then verify *from the account*
    // into a context account (this is what spl-token-client does for large proofs).
    let record = Keypair::new();
    let record_key = record.pubkey();
    let range_bytes = bytemuck::bytes_of(&proofs.range_proof_data);
    let (record_txs, range_verify_tx) =
        record_and_verify_range(&mut ctx, &record, &range_ctx, &authority, &alice.owner, range_bytes);
    let range_txs = [record_txs, vec![range_verify_tx]].concat();
    let transfer_ix = ct_ix::transfer(
        &token_2022(),
        &alice.token.pubkey(),
        &mint.pubkey(),
        &bob.token.pubkey(),
        &new_balance,
        &validity.ciphertext_lo,
        &validity.ciphertext_hi,
        &authority,
        &[],
        ProofLocation::ContextStateAccount(&eq_key),
        ProofLocation::ContextStateAccount(&val_key),
        ProofLocation::ContextStateAccount(&range_key),
    )
    .unwrap();
    let mut transfer_ixs = transfer_ix.clone();
    // Close the three context accounts in the same transaction to reclaim their rent.
    for key in [&eq_key, &val_key, &range_key] {
        transfer_ixs.push(close_context_state(
            ContextStateInfo { context_state_account: key, context_state_authority: &authority },
            &ctx.payer.pubkey(),
        ));
    }
    transfer_ixs.push(spl_record::instruction::close_account(&record_key, &alice.owner.pubkey(), &ctx.payer.pubkey()));
    let tx_transfer = ctx.send("transfer (3 contexts) + close contexts + record", &transfer_ixs, &[&alice.owner]);

    let transfer_set: Vec<TxStat> = [vec![tx_eq, tx_val], range_txs, vec![tx_transfer.clone()]].concat();
    let total_cu: u64 = transfer_set.iter().map(|s| s.compute_units).sum();
    let total_fee: u64 = transfer_set.iter().map(|s| s.fee).sum();
    let total_bytes: usize = transfer_set.iter().map(|s| s.size).sum();
    let ctx_rent = ctx.rent(size_of::<ProofContextState<CiphertextCommitmentEqualityProofContext>>())
        + ctx.rent(size_of::<ProofContextState<BatchedGroupedCiphertext3HandlesValidityProofContext>>())
        + ctx.rent(size_of::<ProofContextState<BatchedRangeProofContext>>());
    println!(
        "  => one confidential transfer = {} transactions, {} CU, {} B on the wire, {} lamports fees, \
         {} lamports rent locked until the contexts are closed",
        transfer_set.len(), total_cu, total_bytes, total_fee, ctx_rent
    );

    apply_pending(&mut ctx, &bob, "bob");

    // ---- withdraw back to public ---------------------------------------------------------------
    println!("\n[withdraw confidential -> public, bob $0.42]");
    let account = ctx.ct_account(&bob.token.pubkey());
    let current = decrypt_available(&account, &bob.aes);
    let (wproofs, wtime) = timed(|| {
        withdraw_proof_data(&available_ciphertext(&account), current, TRANSFER, &bob.elgamal).unwrap()
    });
    println!("  proof: withdraw (equality + U64 range) {:?}", wtime);
    let new_bob = bob.aes.encrypt(current - TRANSFER).into();
    let inline_w = ct_ix::withdraw(
        &token_2022(),
        &bob.token.pubkey(),
        &mint.pubkey(),
        TRANSFER,
        DECIMALS,
        &new_bob,
        &bob.owner.pubkey(),
        &[],
        ProofLocation::InstructionOffset(NonZeroI8::new(1).unwrap(), &wproofs.equality_proof_data),
        ProofLocation::InstructionOffset(NonZeroI8::new(2).unwrap(), &wproofs.range_proof_data),
    )
    .unwrap();
    let inline_w_size = ctx.tx_size(&inline_w, &[&bob.owner]);
    println!("  option A (withdraw with inline proofs, 1 tx): {inline_w_size} B -> {}",
        if inline_w_size <= PACKET_DATA_SIZE { "fits" } else { "DOES NOT FIT" });
    let (weq, wrange) = (Keypair::new(), Keypair::new());
    let (weq_key, wrange_key, bob_owner) = (weq.pubkey(), wrange.pubkey(), bob.owner.pubkey());
    let mut withdraw_set = verify_into_context(
        &mut ctx, "withdraw equality", ProofInstruction::VerifyCiphertextCommitmentEquality,
        &wproofs.equality_proof_data, &weq, &bob.owner, None,
    );
    let wrecord = Keypair::new();
    withdraw_set.extend(verify_into_context(
        &mut ctx, "withdraw U64 range", ProofInstruction::VerifyBatchedRangeProofU64,
        &wproofs.range_proof_data, &wrange, &bob.owner, Some(&wrecord),
    ));
    let mut wixs = ct_ix::withdraw(
        &token_2022(), &bob.token.pubkey(), &mint.pubkey(), TRANSFER, DECIMALS, &new_bob, &bob_owner, &[],
        ProofLocation::ContextStateAccount(&weq_key), ProofLocation::ContextStateAccount(&wrange_key),
    )
    .unwrap();
    for key in [&weq_key, &wrange_key] {
        wixs.push(close_context_state(ContextStateInfo { context_state_account: key, context_state_authority: &bob_owner }, &ctx.payer.pubkey()));
    }
    if ctx.account_exists(&wrecord.pubkey()) {
        wixs.push(spl_record::instruction::close_account(&wrecord.pubkey(), &bob_owner, &ctx.payer.pubkey()));
    }
    let withdraw = ctx.send("withdraw 0.42 (2 contexts) + close", &wixs, &[&bob.owner]);
    withdraw_set.push(withdraw.clone());
    println!("  => one withdraw = {} transactions, {} CU",
        withdraw_set.len(), withdraw_set.iter().map(|s| s.compute_units).sum::<u64>());

    // ---- what the world sees --------------------------------------------------------------
    println!("\n[observer view]");
    let transfer_json = ctx.get_transaction_json(&tx_transfer.signature);
    let deposit_json = ctx.get_transaction_json(&deposit.signature);
    let withdraw_json = ctx.get_transaction_json(&withdraw.signature);
    fs::write("out/q2-transfer-tx.json", serde_json::to_string_pretty(&transfer_json).unwrap()).unwrap();
    fs::write("out/q2-deposit-tx.json", serde_json::to_string_pretty(&deposit_json).unwrap()).unwrap();
    fs::write("out/q2-withdraw-tx.json", serde_json::to_string_pretty(&withdraw_json).unwrap()).unwrap();
    fs::write("out/q2-alice-account.json", serde_json::to_string_pretty(&ctx.get_account_json(&alice.token.pubkey())).unwrap()).unwrap();
    fs::write("out/q2-bob-account.json", serde_json::to_string_pretty(&ctx.get_account_json(&bob.token.pubkey())).unwrap()).unwrap();
    let transfer_ix_json = &transfer_json["transaction"]["message"]["instructions"][0];
    println!("  transfer instruction as parsed by RPC:\n{}", serde_json::to_string_pretty(transfer_ix_json).unwrap());
    println!("  deposit instruction as parsed by RPC:\n{}",
        serde_json::to_string_pretty(&deposit_json["transaction"]["message"]["instructions"][0]).unwrap());
    println!("  withdraw instruction as parsed by RPC:\n{}",
        serde_json::to_string_pretty(&withdraw_json["transaction"]["message"]["instructions"][0]).unwrap());
    println!("  token balance changes in the transfer tx: pre={} post={}",
        transfer_json["meta"]["preTokenBalances"], transfer_json["meta"]["postTokenBalances"]);
    println!("  alice public amount now {} (base units); bob public amount now {}",
        ctx.public_amount(&alice.token.pubkey()), ctx.public_amount(&bob.token.pubkey()));

    // ---- what the auditor can decrypt --------------------------------------------------------
    println!("\n[auditor view]");
    let lo = auditor.secret().decrypt_u32(&validity.ciphertext_lo.try_into().unwrap()).unwrap();
    let hi = auditor.secret().decrypt_u32(&validity.ciphertext_hi.try_into().unwrap()).unwrap();
    println!("  auditor decrypts transfer amount: lo={lo} hi={hi} -> {}", lo + (hi << 16));
    let bob_account = ctx.ct_account(&bob.token.pubkey());
    let bob_avail: solana_zk_sdk::encryption::elgamal::ElGamalCiphertext = bob_account.available_balance.try_into().unwrap();
    println!("  auditor decrypting bob's available balance with its key: {:?}",
        auditor.secret().decrypt_u32(&bob_avail));
    println!("  bob decrypting his own available balance: {:?}", bob.elgamal.secret().decrypt_u32(&bob_avail));

    let summary = json!({
        "transactions": ctx.stats.iter().map(|s| json!({
            "label": s.label, "signature": s.signature, "bytes": s.size,
            "compute_units": s.compute_units, "fee_lamports": s.fee, "instructions": s.instructions,
        })).collect::<Vec<_>>(),
        "transfer": {
            "transactions": transfer_set.len(), "compute_units": total_cu, "bytes": total_bytes,
            "fee_lamports": total_fee, "context_rent_lamports": ctx_rent,
            "inline_single_tx_bytes": inline_size, "proof_generation_ms": proof_time.as_secs_f64() * 1e3,
            "proof_sizes": {"equality": proof_sizes[0], "validity_3_handles": proof_sizes[1], "range_u128": proof_sizes[2]},
        },
        "withdraw": {"transactions": withdraw_set.len(), "compute_units": withdraw_set.iter().map(|s| s.compute_units).sum::<u64>(), "inline_single_tx_bytes": inline_w_size, "proof_generation_ms": wtime.as_secs_f64() * 1e3},
    });
    fs::write("out/q2-summary.json", serde_json::to_string_pretty(&summary).unwrap()).unwrap();
    println!("\nwrote out/q2-*.json");
}

/// Writes `proof` into a new record account (authority `owner`) in as few transactions as fit,
/// then verifies it from the account into context account `ctx_account`.
fn record_and_verify_range(
    ctx: &mut Ctx,
    record: &Keypair,
    ctx_account: &Keypair,
    ctx_authority: &solana_address::Address,
    owner: &Keypair,
    proof: &[u8],
) -> (Vec<TxStat>, TxStat) {
    let start = spl_record::state::RecordData::WRITABLE_START_INDEX;
    let space = start + proof.len();
    let record_key = record.pubkey();
    let owner_key = owner.pubkey();
    let first = |chunk: &[u8]| {
        vec![
            ctx.create_account_ix(&record_key, space, &spl_record::id()),
            spl_record::instruction::initialize(&record_key, &owner_key),
            spl_record::instruction::write(&record_key, &owner_key, 0, chunk),
        ]
    };
    // Largest first chunk that fits alongside create + initialize.
    let mut n = proof.len();
    while ctx.tx_size(&first(&proof[..n]), &[record, owner]) > PACKET_DATA_SIZE {
        n -= 8;
    }
    let mut txs = vec![ctx.send(&format!("record: create+init+write {n} B"), &first(&proof[..n]), &[record, owner])];
    let mut offset = n;
    while offset < proof.len() {
        let mut m = proof.len() - offset;
        let write = |m: usize| vec![spl_record::instruction::write(&record_key, &owner_key, offset as u64, &proof[offset..offset + m])];
        while ctx.tx_size(&write(m), &[owner]) > PACKET_DATA_SIZE {
            m -= 8;
        }
        txs.push(ctx.send(&format!("record: write {m} B"), &write(m), &[owner]));
        offset += m;
    }
    let ctx_key = ctx_account.pubkey();
    let verify = ctx.send(
        "verify range proof from record -> context",
        &[
            ctx.create_account_ix(&ctx_key, size_of::<ProofContextState<BatchedRangeProofContext>>(), &solana_zk_elgamal_proof_interface::id()),
            ProofInstruction::VerifyBatchedRangeProofU128.encode_verify_proof_from_account(
                Some(ContextStateInfo { context_state_account: &ctx_key, context_state_authority: ctx_authority }),
                &record_key,
                start as u32,
            ),
        ],
        &[ctx_account],
    );
    (txs, verify)
}

fn party() -> Party {
    Party { owner: Keypair::new(), token: Keypair::new(), elgamal: ElGamalKeypair::new_rand(), aes: AeKey::new_rand() }
}

fn apply_pending(ctx: &mut Ctx, p: &Party, name: &str) {
    let account = ctx.ct_account(&p.token.pubkey());
    let pending = decrypt_pending(&account, p.elgamal.secret());
    let available = decrypt_available(&account, &p.aes);
    let counter: u64 = account.pending_balance_credit_counter.into();
    ctx.send(
        &format!("apply pending balance ({name}, +{pending})"),
        &[ct_ix::apply_pending_balance(
            &token_2022(),
            &p.token.pubkey(),
            counter,
            &p.aes.encrypt(available + pending).into(),
            &p.owner.pubkey(),
            &[],
        )
        .unwrap()],
        &[&p.owner],
    );
}
