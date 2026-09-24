//! Shared helpers for the confidential-transfer spike. Localnet only.
//!
//! Talks JSON-RPC directly (via curl) instead of `solana-rpc-client`: spl-token-client 0.19.1
//! does not compile against the solana-rpc-client 4.3.0 that Cargo resolves for it (it asks for
//! `4.0.0-rc.0`, which admits 4.3.0, whose `Transaction` type is a different major version).
//!
//! Every transaction goes through [`Ctx::send`], which records serialized size, compute units,
//! fee and signature: the numbers the spike reports.

use {
    base64::{engine::general_purpose::STANDARD as B64, Engine},
    serde_json::{json, Value},
    solana_address::Address,
    solana_hash::Hash,
    solana_instruction::Instruction,
    solana_keypair::Keypair,
    solana_signer::Signer,
    solana_system_interface::instruction as system_ix,
    solana_transaction::Transaction,
    solana_zk_sdk::encryption::{
        auth_encryption::{AeCiphertext, AeKey},
        elgamal::{ElGamalCiphertext, ElGamalSecretKey},
    },
    spl_token_2022_interface::{
        extension::{
            confidential_transfer::ConfidentialTransferAccount, BaseStateWithExtensions,
            ExtensionType, StateWithExtensionsOwned,
        },
        state::{Account, Mint},
    },
    std::{
        str::FromStr,
        time::{Duration, Instant},
    },
};

pub const RPC_URL: &str = "http://127.0.0.1:8999";
/// Solana's transaction size limit (bytes).
pub const PACKET_DATA_SIZE: usize = 1232;

#[derive(Debug, Clone)]
pub struct TxStat {
    pub label: String,
    pub signature: String,
    pub size: usize,
    pub compute_units: u64,
    pub fee: u64,
    pub instructions: usize,
}

pub struct Ctx {
    pub payer: Keypair,
    pub stats: Vec<TxStat>,
}

impl Ctx {
    /// Funds a fresh payer from the localnet faucet.
    pub fn new() -> Self {
        let payer = Keypair::new();
        let ctx = Self { payer, stats: vec![] };
        let sig = ctx.rpc("requestAirdrop", json!([ctx.payer.pubkey().to_string(), 100_000_000_000u64]));
        ctx.confirm(sig.as_str().unwrap()).expect("airdrop failed");
        ctx
    }

    pub fn rpc(&self, method: &str, params: Value) -> Value {
        assert!(RPC_URL.contains("127.0.0.1"), "spike is localnet only");
        let body = json!({"jsonrpc": "2.0", "id": 1, "method": method, "params": params});
        let out = std::process::Command::new("curl")
            .args(["-s", "-X", "POST", "-H", "Content-Type: application/json", "--data-binary", "@-"])
            .arg(RPC_URL)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .spawn()
            .and_then(|mut child| {
                use std::io::Write;
                child.stdin.take().unwrap().write_all(body.to_string().as_bytes())?;
                child.wait_with_output()
            })
            .expect("curl");
        let v: Value = serde_json::from_slice(&out.stdout).expect("rpc json");
        if !v["error"].is_null() {
            return json!({"__error": v["error"]});
        }
        v["result"].clone()
    }

    pub fn blockhash(&self) -> Hash {
        let v = self.rpc("getLatestBlockhash", json!([{"commitment": "confirmed"}]));
        Hash::from_str(v["value"]["blockhash"].as_str().unwrap()).unwrap()
    }

    /// Polls until confirmed; Ok(()) on success, Err(status error) if the transaction failed.
    pub fn confirm(&self, signature: &str) -> Result<(), Value> {
        for _ in 0..240 {
            let v = self.rpc("getSignatureStatuses", json!([[signature]]));
            let status = &v["value"][0];
            if !status.is_null() {
                if !status["err"].is_null() {
                    return Err(status["err"].clone());
                }
                if matches!(status["confirmationStatus"].as_str(), Some("confirmed" | "finalized")) {
                    return Ok(());
                }
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        panic!("{signature} not confirmed in time");
    }

    fn sign(&self, ixs: &[Instruction], signers: &[&Keypair], blockhash: Hash) -> Transaction {
        let mut all: Vec<&Keypair> = vec![&self.payer];
        all.extend_from_slice(signers);
        Transaction::new_signed_with_payer(ixs, Some(&self.payer.pubkey()), &all, blockhash)
    }

    /// Serialized size of a transaction with these instructions (payer + signers).
    pub fn tx_size(&self, ixs: &[Instruction], signers: &[&Keypair]) -> usize {
        bincode::serialize(&self.sign(ixs, signers, Hash::default())).unwrap().len()
    }

    /// Sends one transaction (payer pays fees), waits for confirmation and records its stats.
    /// Panics with the program logs if it fails.
    pub fn send(&mut self, label: &str, ixs: &[Instruction], signers: &[&Keypair]) -> TxStat {
        self.try_send(label, ixs, signers)
            .unwrap_or_else(|logs| panic!("{label} failed:\n{}", logs.join("\n")))
    }

    /// Like `send`, but returns the logs on failure instead of panicking.
    pub fn try_send(
        &mut self,
        label: &str,
        ixs: &[Instruction],
        signers: &[&Keypair],
    ) -> Result<TxStat, Vec<String>> {
        let tx = self.sign(ixs, signers, self.blockhash());
        let bytes = bincode::serialize(&tx).unwrap();
        let size = bytes.len();
        let sent = self.rpc(
            "sendTransaction",
            json!([B64.encode(&bytes), {"encoding": "base64", "preflightCommitment": "confirmed"}]),
        );
        if let Some(err) = sent.get("__error") {
            let logs = err["data"]["logs"]
                .as_array()
                .map(|l| l.iter().map(|x| x.as_str().unwrap_or("").to_string()).collect())
                .unwrap_or_else(|| vec![err.to_string()]);
            return Err(logs);
        }
        let signature = sent.as_str().unwrap().to_string();
        if let Err(err) = self.confirm(&signature) {
            let parsed = self.get_transaction_json(&signature);
            let mut logs = vec![format!("status: {err}")];
            logs.extend(log_lines(&parsed));
            return Err(logs);
        }
        let parsed = self.get_transaction_json(&signature);
        let stat = TxStat {
            label: label.to_string(),
            signature,
            size,
            compute_units: parsed["meta"]["computeUnitsConsumed"].as_u64().unwrap_or(0),
            fee: parsed["meta"]["fee"].as_u64().unwrap_or(0),
            instructions: ixs.len(),
        };
        println!(
            "  tx {:<46} {:>5} B {:>8} CU  fee {:>5} lamports  ({} ix)",
            stat.label, stat.size, stat.compute_units, stat.fee, stat.instructions
        );
        self.stats.push(stat.clone());
        Ok(stat)
    }

    /// getTransaction with jsonParsed encoding: what any outside observer can read.
    pub fn get_transaction_json(&self, signature: &str) -> Value {
        for _ in 0..40 {
            let v = self.rpc(
                "getTransaction",
                json!([signature, {"encoding": "jsonParsed", "commitment": "confirmed", "maxSupportedTransactionVersion": 0}]),
            );
            if !v.is_null() {
                return v;
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        panic!("transaction {signature} not found");
    }

    /// getAccountInfo with jsonParsed encoding.
    pub fn get_account_json(&self, address: &Address) -> Value {
        self.rpc(
            "getAccountInfo",
            json!([address.to_string(), {"encoding": "jsonParsed", "commitment": "confirmed"}]),
        )["value"]
            .clone()
    }

    pub fn account_data(&self, address: &Address) -> Vec<u8> {
        let v = self.rpc(
            "getAccountInfo",
            json!([address.to_string(), {"encoding": "base64", "commitment": "confirmed"}]),
        );
        B64.decode(v["value"]["data"][0].as_str().expect("account exists")).unwrap()
    }

    pub fn account_exists(&self, address: &Address) -> bool {
        !self.rpc(
            "getAccountInfo",
            json!([address.to_string(), {"encoding": "base64", "commitment": "confirmed"}]),
        )["value"]
            .is_null()
    }

    pub fn rent(&self, space: usize) -> u64 {
        self.rpc("getMinimumBalanceForRentExemption", json!([space])).as_u64().unwrap()
    }

    pub fn create_account_ix(&self, new: &Address, space: usize, owner: &Address) -> Instruction {
        system_ix::create_account(&self.payer.pubkey(), new, self.rent(space), space as u64, owner)
    }

    pub fn ct_account(&self, address: &Address) -> ConfidentialTransferAccount {
        let state = StateWithExtensionsOwned::<Account>::unpack(self.account_data(address)).unwrap();
        *state.get_extension::<ConfidentialTransferAccount>().unwrap()
    }

    pub fn public_amount(&self, address: &Address) -> u64 {
        StateWithExtensionsOwned::<Account>::unpack(self.account_data(address))
            .unwrap()
            .base
            .amount
    }
}

impl Default for Ctx {
    fn default() -> Self {
        Self::new()
    }
}

pub fn log_lines(parsed_tx: &Value) -> Vec<String> {
    parsed_tx["meta"]["logMessages"]
        .as_array()
        .map(|l| l.iter().map(|x| x.as_str().unwrap_or("").to_string()).collect())
        .unwrap_or_default()
}

pub fn mint_len(extensions: &[ExtensionType]) -> usize {
    ExtensionType::try_calculate_account_len::<Mint>(extensions).unwrap()
}

pub fn account_len(extensions: &[ExtensionType]) -> usize {
    ExtensionType::try_calculate_account_len::<Account>(extensions).unwrap()
}

/// Runs `f`, returning its result and how long it took.
pub fn timed<T>(f: impl FnOnce() -> T) -> (T, Duration) {
    let start = Instant::now();
    let out = f();
    (out, start.elapsed())
}

// ---- balance helpers (what spl-token-client's account-info types do) --------------------------

pub fn available_ciphertext(account: &ConfidentialTransferAccount) -> ElGamalCiphertext {
    account.available_balance.try_into().unwrap()
}

pub fn decryptable_available(account: &ConfidentialTransferAccount) -> AeCiphertext {
    account.decryptable_available_balance.try_into().unwrap()
}

/// The owner's fast path: the AES-encrypted copy of the available balance.
pub fn decrypt_available(account: &ConfidentialTransferAccount, aes: &AeKey) -> u64 {
    aes.decrypt(&decryptable_available(account)).expect("decrypt available")
}

/// Pending balance = lo + hi << 16, each an ElGamal ciphertext of a small number.
pub fn decrypt_pending(account: &ConfidentialTransferAccount, secret: &ElGamalSecretKey) -> u64 {
    let lo: ElGamalCiphertext = account.pending_balance_lo.try_into().unwrap();
    let hi: ElGamalCiphertext = account.pending_balance_hi.try_into().unwrap();
    let lo = secret.decrypt_u32(&lo).expect("pending lo");
    let hi = secret.decrypt_u32(&hi).expect("pending hi");
    lo + (hi << 16)
}

// ---- proofs -> context accounts ---------------------------------------------------------------

use solana_zk_elgamal_proof_interface::{
    instruction::{ContextStateInfo, ProofInstruction},
    state::ProofContextState,
};
use std::mem::size_of;

/// Verifies `data` into context account `ctx_account` (authority `owner`): in one transaction
/// with the account creation if it fits, otherwise via a record account (`record` must be given).
#[allow(clippy::too_many_arguments)]
pub fn verify_into_context<T, U>(
    ctx: &mut Ctx,
    what: &str,
    instruction: ProofInstruction,
    data: &T,
    ctx_account: &Keypair,
    owner: &Keypair,
    record: Option<&Keypair>,
) -> Vec<TxStat>
where
    T: bytemuck::Pod + solana_zk_elgamal_proof_interface::proof_data::ZkProofData<U>,
    U: bytemuck::Pod,
{
    let key = ctx_account.pubkey();
    let authority = owner.pubkey();
    let info = ContextStateInfo { context_state_account: &key, context_state_authority: &authority };
    let ixs = vec![
        ctx.create_account_ix(&key, size_of::<ProofContextState<U>>(), &solana_zk_elgamal_proof_interface::id()),
        instruction.encode_verify_proof(Some(info), data),
    ];
    if ctx.tx_size(&ixs, &[ctx_account]) <= PACKET_DATA_SIZE {
        return vec![ctx.send(&format!("verify {what} -> context"), &ixs, &[ctx_account])];
    }
    let record = record.expect("proof too large for one transaction; need a record account");
    let bytes = bytemuck::bytes_of(data);
    let start = spl_record::state::RecordData::WRITABLE_START_INDEX;
    let space = start + bytes.len();
    let rkey = record.pubkey();
    let first = |chunk: &[u8]| vec![
        ctx.create_account_ix(&rkey, space, &spl_record::id()),
        spl_record::instruction::initialize(&rkey, &authority),
        spl_record::instruction::write(&rkey, &authority, 0, chunk),
    ];
    let mut n = bytes.len();
    while ctx.tx_size(&first(&bytes[..n]), &[record, owner]) > PACKET_DATA_SIZE { n -= 8; }
    let mut txs = vec![ctx.send(&format!("record ({what}): create+init+write {n} B"), &first(&bytes[..n]), &[record, owner])];
    let mut offset = n;
    while offset < bytes.len() {
        let mut m = bytes.len() - offset;
        let write = |m: usize| vec![spl_record::instruction::write(&rkey, &authority, offset as u64, &bytes[offset..offset + m])];
        while ctx.tx_size(&write(m), &[owner]) > PACKET_DATA_SIZE { m -= 8; }
        txs.push(ctx.send(&format!("record ({what}): write {m} B"), &write(m), &[owner]));
        offset += m;
    }
    txs.push(ctx.send(
        &format!("verify {what} from record -> context"),
        &[
            ctx.create_account_ix(&key, size_of::<ProofContextState<U>>(), &solana_zk_elgamal_proof_interface::id()),
            instruction.encode_verify_proof_from_account(Some(info), &rkey, start as u32),
        ],
        &[ctx_account],
    ));
    txs
}

