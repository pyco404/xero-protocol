//! Q1, read-only: is the ZK ElGamal proof program *executing* on devnet and mainnet today?
//!
//! Builds proof-verification transactions and calls `simulateTransaction` with
//! `sigVerify: false` and `replaceRecentBlockhash: true`. Nothing is signed, sent or paid; the
//! fee payer is only named (a funded system account), never used.
//!
//! Cases: a valid ciphertext-commitment equality proof (expect success), the same proof with one
//! byte of its statement changed (expect "proof verification failed"), and a valid pubkey-validity
//! proof (expect success).

use {
    base64::{engine::general_purpose::STANDARD as B64, Engine},
    serde_json::{json, Value},
    solana_address::Address,
    solana_transaction::Transaction,
    solana_zk_elgamal_proof_interface::instruction::ProofInstruction,
    solana_zk_sdk::{
        encryption::{elgamal::ElGamalKeypair, pedersen::Pedersen},
        zk_elgamal_proof_program::{
            build_pubkey_validity_proof_data,
            ciphertext_commitment_equality::build_ciphertext_commitment_equality_proof_data,
        },
    },
    std::str::FromStr,
};

/// Any funded system account works as a (never-charged) fee payer in a simulation. These are the
/// Token-2022 upgrade authorities on each cluster (system accounts with SOL), as of 2026-09-24.
const MAINNET_FEE_PAYER: &str = "AeLmXCbPaQHGWRLr2saFsEVfmMNuKnxRAbWCT9P5twgz";
const DEVNET_FEE_PAYER: &str = "3URRPr96EV2wuNRgQKwQpuZitHHsVyDUen1eRSvEun9G";

fn simulate(url: &str, fee_payer: &str, ix: solana_instruction::Instruction) -> Value {
    let payer = Address::from_str(fee_payer).unwrap();
    let tx = Transaction::new_unsigned(solana_transaction::Message::new(&[ix], Some(&payer)));
    let body = json!({"jsonrpc": "2.0", "id": 1, "method": "simulateTransaction", "params": [
        B64.encode(bincode::serialize(&tx).unwrap()),
        {"encoding": "base64", "sigVerify": false, "replaceRecentBlockhash": true, "commitment": "confirmed"}
    ]});
    let out = std::process::Command::new("curl")
        .args(["-s", "--max-time", "30", "-X", "POST", "-H", "Content-Type: application/json", "-d"])
        .arg(body.to_string())
        .arg(url)
        .output()
        .unwrap();
    serde_json::from_slice(&out.stdout).unwrap()
}

fn main() {
    let keypair = ElGamalKeypair::new_rand();
    let amount = 420_000u64;
    let ciphertext = keypair.pubkey().encrypt(amount);
    let (commitment, opening) = Pedersen::new(amount);
    let valid = build_ciphertext_commitment_equality_proof_data(&keypair, &ciphertext, &commitment, &opening, amount).unwrap();
    // Swap in a valid commitment to a *different* amount: well-formed, but the proof no longer holds.
    let mut tampered = valid;
    tampered.context.commitment = Pedersen::new(amount + 1).0.into();
    let pubkey_validity = build_pubkey_validity_proof_data(&keypair).unwrap();

    for (name, url, payer) in [
        ("devnet", "https://api.devnet.solana.com", DEVNET_FEE_PAYER),
        ("mainnet-beta", "https://api.mainnet-beta.solana.com", MAINNET_FEE_PAYER),
    ] {
        println!("== {name} ({url})");
        for (case, ix) in [
            ("valid equality proof", ProofInstruction::VerifyCiphertextCommitmentEquality.encode_verify_proof(None, &valid)),
            ("equality proof, other commitment", ProofInstruction::VerifyCiphertextCommitmentEquality.encode_verify_proof(None, &tampered)),
            ("valid pubkey-validity proof", ProofInstruction::VerifyPubkeyValidity.encode_verify_proof(None, &pubkey_validity)),
        ] {
            let v = simulate(url, payer, ix);
            let r = &v["result"]["value"];
            if !v["error"].is_null() {
                println!("  {case:<30} RPC error: {}", v["error"]);
                continue;
            }
            println!(
                "  {case:<30} slot {} err={} units={} logs={}",
                v["result"]["context"]["slot"], r["err"], r["unitsConsumed"], r["logs"]
            );
        }
    }
}
