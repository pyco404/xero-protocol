# Privacy spike: confidential payments for XERO

Research spike, 2026-09-24. Nothing here changes `xero_policy` or `@xero/sdk`. Prototypes live in
[`protocol/spikes/`](../spikes/) and ran on localnet only; the only calls to devnet or mainnet were
read-only (feature status, account reads, program dumps and `simulateTransaction` with signature
checks off, which sends nothing and pays nothing).

Every claim is tagged:

- **[VERIFIED]** I ran code or a command and saw the result. The spike file or output is named.
- **[READ]** I read it in docs, source or an announcement. Linked, with version or date.
- **[UNKNOWN]** I could not determine it. Stated as such, not guessed.

## Summary

| Question | Answer |
| --- | --- |
| Q1. Usable today? | **Yes, mechanically.** The ZK ElGamal proof program is enabled on mainnet and devnet and verifies proofs today [VERIFIED]. Token-2022 with confidential transfers is live on mainnet [READ]. Proofs can be generated in Rust and in JS/TS via WASM [VERIFIED]. But **USDC on Solana is a classic SPL Token mint and cannot use confidential transfers**, and PYUSD/USDG require issuer approval per account [VERIFIED]. |
| Q2. What does a transfer cost? | One $0.42 confidential transfer took **6 transactions, 250,369 CU, 4,613 bytes, 65,000 lamports of base fees**, ~35 ms of proof generation and **2.6 s** wall clock sent sequentially on localnet [VERIFIED]. Amounts and balances are hidden; senders, recipients, owners, mint, timing and deposit/withdraw amounts are public [VERIFIED]. |
| Q3. PDA-owned vault? | **Yes.** The token account's authority (a PDA) and its ElGamal key are independent; the key lives off-chain and the program authorizes every move via CPI with pre-verified proof context accounts [VERIFIED]. Whoever holds the key can decrypt the balance *and* choose any amount, so policy must be enforced cryptographically (Q4). |
| Q4. Policy on encrypted amounts? | **Yes for max_per_payment and daily_limit**, with existing proof types: a ciphertext-commitment equality proof plus a batched range proof, checked on-chain against the transfer's own ciphertext [VERIFIED]. Forged and mismatched proofs were rejected [VERIFIED]. Cost: **11 transactions, ~483k CU, ~4.5 s per payment** and payments from one vault are strictly serial [VERIFIED]. The allowlist works unchanged [VERIFIED]. |
| Q5. Alternatives | Solana now documents three models: Confidential Balances (this spike), the Solana Privacy Protocol ("Rings", Helius, devnet beta) and Private Channels (Solana Foundation, unaudited) [READ]. Also TEE rollups (MagicBlock), MPC (Arcium Mainnet Alpha) and shielded pools (Privacy Cash) [READ]. |
| Q6. Recommendation | **Go with changes**: confidential transfers are the right *amount-and-balance* privacy layer for a policy vault, but not per-request for sub-dollar micropayments, and not on USDC. See the proposed v2 design and the risk list. |

## Environment

| Component | Version | How it was used |
| --- | --- | --- |
| Agave CLI / test validator | 4.3.0 (`src:825efd18`), installed side by side in `~/.local/share/solana/install/releases/v4.3.0`; the default CLI stays 3.1.10 | Feature status, localnet [VERIFIED] |
| Clusters | mainnet-beta 4.3.0, devnet 4.3.0-rc.0 (`solana cluster-version`, 2026-09-24) | [VERIFIED] |
| Token-2022 on localnet | **The exact mainnet binary**, dumped read-only (sha256 `0999dbf7…`, mainnet last deployed slot 427147035) | The 4.3.0 test validator's bundled Token-2022 is a different binary (sha256 `a794…`, fewer confidential-transfer strings); I did not use it [VERIFIED] |
| spl-record on localnet | Mainnet binary, dumped read-only (`recr1L3…`); not bundled in the test validator | [VERIFIED] |
| Rust crates | `spl-token-2022-interface` 3.1.2, `spl-token-confidential-transfer-proof-generation` 0.6.1, `…-proof-extraction` 0.6.1, `…-ciphertext-arithmetic` 0.5.1, `solana-zk-sdk` 7.0.1, `solana-zk-elgamal-proof-interface` 0.1.3, `spl-record` 0.4.0; rustc 1.97.1 (the 4.3.0 crates require it) | [VERIFIED] |
| JS | `@solana/zk-sdk` 0.5.3 (WASM), `@solana-program/token-2022` 0.19.0, `@solana/kit` 8.3.0, Node 24.13 | [VERIFIED] |

Reproduce: `protocol/spikes/README.md`.

---

## Q1. Is Token-2022 confidential transfer usable today?

### Status and history

| Date | Event | Source |
| --- | --- | --- |
| 2025-04-16 | First ZK ElGamal soundness bug reported (Fiat-Shamir transcript missing algebraic components). Patched in Agave ≥ 2.1.21 / ≥ 2.2.11 without disabling anything. | [READ] [Solana post-mortem, 2025-05-02](https://solana.com/news/post-mortem-may-2-2025) |
| 2025-06-10 | Second, similar bug reported ("a component was not included in a hash used to generate a transcript"). Impact: forged proofs could "mint unlimited tokens or drain a victim's confidential balance". | [READ] [Solana post-mortem, 2025-06-25](https://solana.com/news/post-mortem-june-25-2025) |
| 2025-06-11 | Token-2022 upgraded to remove confidential-transfer instructions. | same |
| 2025-06-19 | Proof program disabled by feature gate at mainnet epoch 805. | same |
| 2025-11-06 | Code4rena, Least Authority and zkSecurity audits complete, "no major vulnerabilities"; Trail of Bits and Qedit ongoing. | [READ] [token-2022#657](https://github.com/solana-program/token-2022/issues/657) (Anza maintainer comments) |
| 2026-04-21 | "The ZK proof program is enabled on testnet and devnet." | same |
| 2026-05-08 | "The updated token-2022 program with confidential transfers is out on testnet and devnet." | same |
| 2026-06-29 | "this is live on mainnet." Issue closed 2026-09-03. | same |

The two post-mortems were fetched through a reader proxy (`r.jina.ai`) because solana.com refuses
direct connections from this machine. The content is the official page's text.

### Feature gates (read-only, 2026-09-24)

[VERIFIED] with `solana feature status --display-all` using the **4.3.0** CLI:

| Feature | ID | mainnet-beta | devnet |
| --- | --- | --- | --- |
| SIMD-0153: Enable ZkElGamalProof program | `zkhiy5oLowR7HY4zogXjCjeMXyruLqBwSWH21qcFtnv` | active since epoch 731 | active since epoch 801 |
| Disables zk-elgamal-proof program | `zkdoVwnSFnSLtGJG7irJPEYUpmb4i7sGMGcnN6T9rnC` | active since epoch 805 | active since epoch 899 |
| **Re-enables zk-elgamal-proof program** | `zkexuyPRdyTVbZqEAREueqL2xvvoBhRgth9xGSc1tMN` | **active since epoch 982** | **active since epoch 1055** |

Current epochs at the time: mainnet 1041, devnet 1164.

**Pitfall** [VERIFIED]: the 3.1.10 CLI does not know `zkexuy…`. It lists an *older* re-enable
gate, `zkesAyFB19sTkX8i9ReoKaMNDA4YNTPYJpZKPDt7FMW`, as **inactive** on both clusters, which would
wrongly suggest the program is still off. Use a 4.x CLI for this check.

### Is the proof program executing? (read-only simulation)

[VERIFIED] `spikes/ct-spike/src/bin/q1_simulate.rs`, output `out-q1.log`. Unsigned proof-verification
transactions sent to `simulateTransaction` (`sigVerify: false`) on both clusters:

| Case | mainnet-beta | devnet |
| --- | --- | --- |
| Valid ciphertext-commitment equality proof | success, 6,400 CU | success, 6,400 CU |
| Same proof with a different (valid) commitment | `proof verification failed: SigmaProof(Equality, AlgebraicRelation)` | same |
| Valid pubkey-validity proof | success, 2,600 CU | success, 2,600 CU |

I did not exercise Token-2022's confidential instructions on mainnet itself (that would need real
accounts and transactions). The deployed mainnet Token-2022 binary was run on localnet for Q2–Q4.

### Versions that support it

- **Agave / CLI** [VERIFIED]: 4.3.0 knows the re-enable gate; 3.1.10 does not. The *first* Agave
  release containing `zkexuy…`: [UNKNOWN], not checked.
- **`spl-token` CLI** [VERIFIED]: 5.6.1 (bundled with Agave 4.3.0; 3.1.10 bundles 5.5.0) has
  `configure-confidential-transfer-account`, `deposit-confidential-tokens`, `apply-pending-balance`,
  `transfer --confidential`, `withdraw-confidential-tokens`. `create-token` has
  `--enable-confidential-transfers auto|manual` but **no auditor-key option**, so the spike used Rust.
- **Rust** [VERIFIED]: the crate set in the table above compiles and runs. Two findings:
  - `spl-token-client` 0.19.1 **does not compile** in a fresh project. It asks for
    `solana-rpc-client = "4.0.0-rc.0"`, which Cargo resolves to 4.3.0, whose `Transaction` type is a
    different major version from the one the client uses. The spike talks JSON-RPC directly instead.
  - The 4.3.0 client crates need rustc 1.97.1 (the protocol's pinned 1.89.0 is too old).
- **JS/TS** [VERIFIED], `spikes/js-zk/proofs.mjs`, output `out-js.log`:
  - `@solana/spl-token` 0.4.15 (what `sdk/` uses) knows the extension *types* only: **no
    confidential instructions, no proofs**.
  - `@solana-program/token-2022` 0.19.0 (`@solana/kit` based) has builders for every
    confidential instruction (configure, deposit, apply pending, transfer, transfer-with-fee,
    withdraw, …) and `@solana-program/zk-elgamal-proof` has the verify/close builders.
    There is **no high-level helper that assembles a transfer's proof set** (the equivalent of Rust's
    `transfer_split_proof_data`): only mint/token/ATA instruction plans are exported.
  - `@solana/zk-sdk` 0.5.3 is WASM ("Universal WASM package for the rust solana-zk-sdk") with
    node, web and bundler builds. It exposes every proof type. Generation in Node:

    | Proof | WASM (Node) | Native Rust (same machine) |
    | --- | --- | --- |
    | Pubkey validity | 0.9–2.5 ms | ~0.1 ms |
    | Ciphertext-commitment equality | 2.4–4.6 ms | (inside the transfer set) |
    | Batched range U64 | 51–58 ms | (inside the withdraw set: 13–23 ms total) |
    | Batched range U128 (a transfer's) | 103–147 ms | (inside the transfer set: 24–45 ms total) |

    The proof program on localnet accepted all WASM-generated proofs and rejected one whose statement
    was swapped (`InvalidInstructionData`). Gotcha: wasm-bindgen *moves* class instances passed by
    value, so a commitment used in one proof cannot be reused in another.
  - `ConfidentialKeys` (in `@solana/zk-sdk`) derives the ElGamal and AES keys from a wallet
    signature, a WebAuthn PRF or raw IKM, and defines `pdaWalletPublicSeed(program_id || wallet_pda
    || mint || token_account)` "for single-signer PDA wallet accounts" [READ, type definitions in the
    package]. That is exactly the Q3 situation.
  - Install note: `@solana/kit` 8.3.0 pulled `undici-types@8.11.1`, whose tarball returned 404 on
    2026-09-24. An `overrides` pin to 7.16.0 worked around it.

### Can XERO's tokens use it? (read-only, mainnet, 2026-09-24)

[VERIFIED] with `getAccountInfo` (`jsonParsed`):

| Mint | Program | Confidential transfers | Other extensions |
| --- | --- | --- | --- |
| USDC `EPjFWdd5…` | **SPL Token (classic)** | **Not possible**: classic mints have no extensions | n/a |
| PYUSD `2b1kV6Dk…` | Token-2022 | `confidentialTransferMint` present, **`autoApproveNewAccounts: false`** (issuer must approve each account), no auditor key | permanent delegate, transfer fee (0 bps now), transfer hook (no program set), confidential transfer fee config |
| USDG `2u1tszSe…` | Token-2022 | same as PYUSD, same authority | same as PYUSD |

Consequences:

- Confidential USDC would require a wrapper mint that XERO or a partner controls. That adds a
  custody/redemption trust assumption. One team reports running exactly that on mainnet ([READ,
  third-party comment on token-2022#657](https://github.com/solana-program/token-2022/issues/657)).
- `xero_policy` v1 rejects PYUSD/USDG today (`UnsupportedMint`: permanent delegate, transfer fee,
  transfer hook).
- For mints with a transfer-fee config, whether the plain confidential `Transfer` works or
  `TransferWithFee` (with its extra fee proofs) is required: [UNKNOWN], not tested.

---

## Q2. A confidential transfer on localnet

Prototype [VERIFIED]: `spikes/ct-spike/src/bin/q2_transfer.rs`, output `out-q2.log`, raw observer
views in `spikes/ct-spike/out/q2-*.json`. Mint: 6 decimals, confidential-transfer extension with an
auditor ElGamal key, auto-approve on. Flow: create mint → alice and bob configure confidential
accounts → mint 1000 public to alice → alice deposits 100 → applies pending → **transfers 0.42 to
bob confidentially** → bob applies pending → bob withdraws 0.42 back to public.

### Transactions, sizes, compute

| Step | Tx | Bytes | CU | Base fee (lamports) |
| --- | --- | --- | --- | --- |
| Create mint (+ CT mint, auditor) | 1 | 461 | 2,848 | 10,000 |
| Create + configure account (pubkey-validity proof inline) | 1 per account | 735 | 7,120 | 15,000 |
| Deposit 100 (public → pending) | 1 | 343 | 9,854 | 10,000 |
| Apply pending balance | 1 | 345 | 7,968 | 10,000 |
| **Transfer 0.42:** | **6** | **4,613** | **250,369** | **65,000** |
| &nbsp;&nbsp;verify equality proof → context account | 1 | 710 | 6,550 | 10,000 |
| &nbsp;&nbsp;verify 3-handle ciphertext-validity proof → context | 1 | 934 | 16,550 | 10,000 |
| &nbsp;&nbsp;record account: create + init + write 760 B of the range proof | 1 | 1,232 | 1,348 | 15,000 |
| &nbsp;&nbsp;record account: write remaining 240 B | 1 | 553 | 651 | 10,000 |
| &nbsp;&nbsp;verify U128 range proof from record → context | 1 | 426 | 200,150 | 10,000 |
| &nbsp;&nbsp;Token-2022 `Transfer` using 3 contexts, then close contexts + record | 1 | 758 | 25,120 | 10,000 |
| Recipient: apply pending balance | 1 | 345 | 7,968 | 10,000 |
| **Withdraw 0.42 (confidential → public)** | **5** | | **132,640** | |

Why 6 transactions [VERIFIED]:

- All three proofs inline would be **2,479 B**, against a 1,232 B transaction limit.
- The U128 range proof is 1,000 B. Even alone with its context account it is ~1,239 B, so it has to
  be written to an spl-record account in two chunks and verified *from the account*.
- Equality (320 B) and validity (544 B) each fit alongside their context-account creation.
- The inline withdraw is 1,712 B, so the withdraw needs the same record path.

Rent: the three context accounts plus the record hold **8,539,920 lamports** until closed. I close
them in the transfer transaction, so it is refunded within the same payment.

Proof generation (native Rust, release build): transfer set **24–45 ms**, withdraw set **13–23 ms**,
pubkey validity **~0.1 ms** [VERIFIED, varies run to run].

Wall clock: the 6-transaction transfer took **2.6 s** on localnet sending one transaction after
another and waiting for `confirmed` each time [VERIFIED, `out-q3.log`, "enforce_limits = 0" row].
The equality, validity and record-create transactions do not depend on each other and could be sent
in parallel (about 4 rounds instead of 6), but I did not measure that. Mainnet latency: [UNKNOWN].

### What an outside observer sees

From the confirmed transactions (`getTransaction`, `jsonParsed`) and the account state
(`getAccountInfo`) [VERIFIED, `out/q2-*.json`]:

| Data | Deposit | Confidential transfer | Withdraw | Account state |
| --- | --- | --- | --- | --- |
| Sender token account and owner | public | **public** (`source`, `owner` signer) | public | public |
| Recipient token account | n/a | **public** (`destination`), owner readable from its account | n/a | public |
| Mint | public | public | public | public |
| Amount | **public** (`amount: 100000000`) | **hidden** (not in parsed fields; the raw instruction data carries only ciphertexts) | **public** (`amount: 420000`) | n/a |
| Balances | public part only | `preTokenBalances`/`postTokenBalances` show only the *public* balance, unchanged (900 → 900, 0 → 0) | public part | `availableBalance`, `pendingBalanceLo/Hi` are ElGamal ciphertexts; `decryptableAvailableBalance` is AES |
| Auditor ciphertexts | n/a | In the raw instruction data (`transfer_amount_auditor_ciphertext_lo/hi`). The `jsonParsed` view omits them, but they are on the ledger. | n/a | n/a |
| ElGamal public keys | n/a | Source, destination and auditor pubkeys are in the validity-proof statement (instruction data of the verify transaction) [READ, `BatchedGroupedCiphertext3HandlesValidityProofContext`]; the account's key is in its state | n/a | `elgamalPubkey` public |
| Counts | | | | `pendingBalanceCreditCounter` / `expectedPendingBalanceCreditCounter` reveal **how many** confidential credits an account received |
| Timing, fee payer, context/record accounts, programs used | public | public | public | |

What the auditor can decrypt [VERIFIED]:

- **The transfer amount:** it decrypted `lo=26784, hi=6` → 420,000.
- **Not balances:** decrypting bob's available balance with the auditor key returns `None`. This
  matches Solana's docs: the auditor key "does not reveal an account's full balance or grant
  authority to move tokens" ([READ](https://solana.com/docs/finance/privacy)).

### Implications for sub-dollar agent micropayments

- **Cost per payment (base fees only):** 65,000 lamports for a plain confidential transfer.
  130,000–140,000 lamports for the policy-enforced vault payment in Q4 (11 transactions plus 2
  cleanup). On mainnet add priority fees, which depend on congestion [UNKNOWN]. For comparison, a
  one-signature public transfer pays 5,000 lamports base fee. I don't convert to dollars here
  because that depends on the SOL price.
- **Compute:** 250k CU per plain transfer and ~483k CU per policy-enforced payment. The range
  proofs dominate: a fixed 200,000 CU per U128 verification, 111,000 per U64 [VERIFIED].
- **Latency:** seconds per payment. 2.6 s and 4.4–4.6 s on localnet, sequential [VERIFIED].
- **No concurrency per account:** each transfer's proofs are bound to the sender's *current*
  encrypted balance. Proofs built before another payment landed fail with Token-2022 `Balance
  mismatch` [VERIFIED]. One confidential vault can have **one payment in flight**, so a busy agent
  is throughput-limited by confirmation latency.
- **Recipient work:** incoming payments land in the *pending* balance. The provider must send an
  `ApplyPendingBalance` transaction (~8k CU) before spending, and an account accepts at most
  `maximumPendingBalanceCreditCounter` (65,536 in the spike) credits between applies [VERIFIED].

Net: per-request confidential payments of cents are **technically possible but economically and
operationally heavy**. Fees are a meaningful fraction of a $0.42 payment at almost any SOL price,
and serial multi-second payments cap throughput per vault.

---

## Q3. Can a program-controlled vault hold confidential funds?

Prototype [VERIFIED]: program `spikes/ct-vault` (native Solana program, SBF build with Agave 4.3.0
`cargo-build-sbf`), driver `spikes/ct-spike/src/bin/q3_vault.rs`, output `out-q3.log`.

### Findings

1. **Authority and ElGamal key are separate** [VERIFIED].
   - The vault token account's owner is the policy PDA.
   - Its ElGamal/AES keys were generated off-chain and held by the spender.
   - The spender proved knowledge of the key into a pubkey-validity *context account*.
   - The program then called Token-2022 `ConfigureAccount` via CPI with that context, signing as
     the PDA (`invoke_signed`).
2. **A program can CPI into confidential instructions using pre-verified proof context accounts**
   [VERIFIED]. `ConfigureAccount`, `Deposit`, `ApplyPendingBalance` and `Transfer` all ran as CPIs
   from the vault program, with proofs passed as context accounts (`ProofLocation::ContextStateAccount`).
3. **Holding the key is not enough to move funds** [VERIFIED]. The spender built valid transfer
   proofs and called Token-2022 directly:
   - As authority → `owner does not match`.
   - Naming the PDA as authority → `MissingRequiredSignature`.
4. **Holding the key *is* enough to choose the amount** [VERIFIED]. With the program's policy
   checks switched off, the key holder paid $6 from a vault whose limit was $5. The program never
   sees plaintext, so without Q4-style proofs it cannot enforce any amount rule.

### Who can decrypt what, per key-custody option

| Option | Vault balance | Transfer amounts | Daily total (Q4) | Security implications |
| --- | --- | --- | --- | --- |
| **A. Spender (agent) holds the vault key** (prototyped) | spender | spender, recipient (its own incoming), mint auditor | spender | Agent can pay autonomously. A key leak exposes history and balances but cannot move funds (PDA + program gate) [VERIFIED: direct transfer rejected]. The agent chooses amounts, so policy proofs are mandatory. |
| **B. Owner holds the key; agent asks owner for proofs** | owner | owner, recipient, auditor | owner | Agent is not autonomous (owner or owner's service must be online per payment). Agent learns nothing. Key custody is the owner's problem. |
| **C. Key derived deterministically, shared owner ↔ agent** (e.g. `ConfidentialKeys` from an owner signature over `pdaWalletPublicSeed`) | both | both, recipient, auditor | both | Owner can audit and recover without a separate backup. Rotating the agent does not rotate the key, so a former agent keeps read access forever. |
| **D. Key held by MPC or TEE** (Arcium, MagicBlock) | whoever the network releases it to | same | same | Adds an external trust and liveness dependency. Not prototyped. |
| **Mint auditor** (any option) | **no** [VERIFIED `None`] | **yes** [VERIFIED] | **no** [VERIFIED `None`] | Set by the *mint authority*. On a mint XERO doesn't control (PYUSD/USDG), XERO cannot add or remove it. |

Losing the vault key: withdraw, transfer and empty-account all require proofs made with the secret
key, so without it confidential funds cannot be moved. This follows from the instruction
requirements used in the spike [VERIFIED for transfer/withdraw]. That no Token-2022 escape hatch
exists: [UNKNOWN], not researched. ElGamal key rotation for a funded account: [UNKNOWN], not tested.

Related [READ]: during the 2025–2026 disablement Token-2022 was deployed *without* the confidential
instructions ([token-2022#657](https://github.com/solana-program/token-2022/issues/657)), so funds
in confidential balances could not be moved for about a year. The effect on specific holders:
[UNKNOWN].

---

## Q4. Can policy rules be enforced on encrypted amounts?

**Yes, for all three rules**, prototyped in the same vault program [VERIFIED].

### Mechanism (as built)

The transfer's own **3-handle ciphertext-validity context** contains the amount, encrypted under the
source (vault) key, as `lo` (16 bits) and `hi` (32 bits). Inside `Pay`, before the Token-2022 CPI,
the program:

1. Reads that ciphertext from **the same context account it passes to the CPI**. This is what binds
   the policy check to the transfer. It checks the account is owned by the proof program, has the
   right proof type, and names the vault's registered ElGamal key.
2. Computes homomorphically on-chain (curve25519 syscalls, via
   `spl-token-confidential-transfer-ciphertext-arithmetic`, the crate Token-2022 itself uses):
   - `max_diff  = Enc(max, r=0) − (lo + 2¹⁶·hi)`
   - `new_total = total + (lo + 2¹⁶·hi)`, where `total` is an **encrypted running total stored in
     the policy account**, reset to `Enc(0)` when the 24 h window rolls over (same rule as
     `xero_policy`).
   - `remaining = Enc(daily, r=0) − new_total`
3. Requires two **ciphertext-commitment equality** contexts, whose ciphertexts must equal
   `max_diff` and `remaining` byte for byte, and one **batched range proof (U128 = 2 × 64 bits)**
   context over those two commitments. A negative difference wraps around the group order, so no
   64-bit range proof exists for it.
4. Stores `new_total` and CPIs the transfer.

### Results

| Case | Result |
| --- | --- |
| $0.42 then $5.00 (max $5, daily $6) | Both settle; auditor reads 420,000 and 5,000,000 |
| $1.00 when the total would reach $6.42 (honest client) | Refused locally: the client cannot build a range proof for −420,000 |
| $1.00 with a **forged** "remaining ≥ 0" equality proof (valid proof for Enc(0), statement swapped to the real ciphertext) | **Proof program** rejects: `SigmaProof(Equality, AlgebraicRelation)` |
| $6.00 when max is $5 (honest client) | Refused locally |
| $6.00 with valid policy proofs **made for a $0.10 amount** | **Vault program** rejects: `max_per_payment proof is for a different amount` |
| $0.10 to `unknown.api` | **Vault program** rejects: `recipient not allowed`. The allowlist is unchanged because recipients stay public. |
| Second payment built from the pre-payment state | **Token-2022** rejects: `Balance mismatch` |
| Same $6.00 with enforcement off | Settles: shows the policy proofs are what enforce the limits |

The honest builder in `solana-zk-sdk` refuses to build an equality proof for a false statement
(`InconsistentInput`), so the forgery test hand-crafted one [VERIFIED].

### Cost of enforcement [VERIFIED]

| | Plain CT transfer via the vault | With max + daily enforcement |
| --- | --- | --- |
| Transactions (excluding cleanup) | 6 | 11 |
| Total CU | 245,197 | 483,264–483,274 |
| `Pay` instruction itself | 19,948 CU, 700 B | 42,766–42,776 CU, 796 B |
| Extra proof generation | n/a | 24–57 ms native |
| Wall clock, sequential, localnet | 2.56 s | 4.35–4.63 s |
| Base fees incl. 2 cleanup transactions | | 140,000 lamports |

### Which proofs make this possible, and what's missing

Available in the ZK ElGamal proof program [READ, `solana-zk-elgamal-proof-interface` 0.1.3
`ProofInstruction`; costs VERIFIED where measured]:

| Proof | Cost | Used here |
| --- | --- | --- |
| zero-ciphertext | not measured | no |
| ciphertext-ciphertext equality | not measured | no |
| ciphertext-commitment equality | 6,400 CU | yes |
| pubkey validity | 2,600 CU | yes |
| percentage-with-cap | not measured | no (for fees) |
| batched range U64 | 111,000 CU | withdraw |
| batched range U128 | 200,000 CU | transfer, policy |
| batched range U256 | not measured | no |
| grouped-ciphertext 2- or 3-handle validity (single and batched) | 16,550 CU for batched 3-handle, including context-account creation | yes |

What's missing or awkward:

- **No direct "ciphertext ≤ public bound" proof.** It has to be composed as equality plus range,
  with the program redoing the ciphertext arithmetic on-chain.
- **No proof aggregation across statements.** Each statement is its own context account and its own
  transaction(s), which is why a policy payment is 11 transactions.
- **Range proofs are large and expensive:** 1,000 B and a fixed 200,000 CU for U128. They need the
  record-account detour because they don't fit in a transaction.
- **Hidden limits** (encrypting `max`/`daily` so they aren't public) should work with the same
  arithmetic by storing `Enc(max)` instead of `max·G`. [UNKNOWN], not prototyped.

---

## Q5. Alternatives (research only)

Solana's docs now describe privacy as "a set of application-level tools rather than a single
network mode", and name three models ([READ, solana.com/docs/finance/privacy, fetched
2026-09-24](https://solana.com/docs/finance/privacy)).

| Approach | Hides | Maturity (as read) | Policy fit | Trust model | Sources |
| --- | --- | --- | --- | --- | --- |
| **Confidential Balances** (Token-2022, this spike) | Amounts, balances | Live on mainnet since June 2026 after a year disabled [READ]; working today [VERIFIED] | Programmable via Q4 composition [VERIFIED], at 11 tx / payment | Cryptographic (twisted ElGamal, sigma and range proofs); two past soundness bugs | [Solana docs](https://solana.com/docs/finance/privacy), [#657](https://github.com/solana-program/token-2022/issues/657) |
| **Solana Privacy Protocol / "Rings"** (Helius) | Default Ring: asset + amount. Custom anonymous Rings: also sender/recipient (relayer) | "live on devnet and currently undergoing independent security audits and formal verification"; beta | Custom Rings list **transfer limits, co-signing, auditor visibility, withdrawal rules**; docs list "Agentic Commerce" as a use case; "each private transfer settles in a single Solana transaction" | ZK proofs; Helius-operated APIs (beta); details of circuits not reviewed | [Helius docs](https://www.helius.dev/docs/privacy/), [concepts](https://www.helius.dev/docs/privacy/concepts) |
| **Private Channels** (Solana Foundation, "Contra") | Everything inside the channel, including counterparties and amounts, from outside observers | "has not been security audited and is not recommended for production use with real funds" | Operator-defined participation, rate limits and compliance; zero per-transfer fee; off-chain throughput | Operator-run gateway/sequencer; exit via Sparse Merkle Tree exclusion proof enforced by an escrow program | [docs](https://solana.com/docs/tools/private-channels), [GitHub](https://github.com/solana-foundation/solana-private-channels) |
| **MagicBlock Private Ephemeral Rollups** | Account state inside the rollup (opt-in, per-account permissions); the Payments API describes "confidential and compliant USDC transfers" | Private Payments API "available today in beta on Solana Mainnet and Devnet", with an MCP server "so AI agents can call it natively"; x402 support announced as future work | On-chain Permission Program for access control; the API adds wallet screening and geofencing; normal Solana programs run inside | **Hardware trust** (Intel TDX) with remote attestation; operator-run rollup | [PER blog](https://www.magicblock.xyz/blog/private-ephemeral-rollups), [Private Payments API](https://www.magicblock.xyz/blog/private-payments-api) |
| **Arcium** (MPC) | Inputs/state of computations run by MPC nodes; "C-SPL" confidential token standard in development | Mainnet Alpha on Solana (Feb 2026 per trade press; not checked on-chain) | Arbitrary encrypted logic, so a policy engine could run on encrypted data | Docs: current tooling supports Cerberus, "a dishonest-majority, detect-and-abort protocol"; liveness depends on the node cluster | [Arcium docs: MPC protocols](https://docs.arcium.com/multi-party-execution-environments-mxes/mpc-protocols), [Cerberus](https://www.arcium.com/research/cerberus), [The Block](https://www.theblock.co/post/387564/arcium-launches-privacy-preserving-mainnet-alpha-on-solana-as-umbra-debuts-shielded-finance-layer) |
| **Shielded pools** (e.g. Privacy Cash) | Link between deposit and withdrawal (counterparties); amounts in newer versions | Live on mainnet; README: SOL today, "Private SPL tokens transfer and private swap will soon follow"; audited by Accretion, HashCloak, Zigtur, Kriko | Poor: a pool breaks the sender→recipient link that allowlists rely on; policy would have to live in circuits | ZK circuits (README lists Circom as a prerequisite; proof system not checked) | [GitHub README](https://github.com/Privacy-Cash/privacy-cash) |
| Elusiv (historical) | Shielded pool | Mainnet March 2023, sunset announced 2024-02-29; the team moved on to MXEs (Arcium) | n/a | n/a | [Elusiv sunset post](https://medium.com/elusiv-privacy/sunsetting-elusiv-transitioning-towards-the-future-of-privacy-and-confidentiality-0b078e9bcfac) |

The maturity and volume figures above come from project and trade-press sources. I did not verify
any of them on-chain.

### Regulatory considerations [READ]

This is not legal advice; these are the primary sources a lawyer would start from.

- **EU AMLR** (Regulation (EU) 2024/1624), Art. 79(1): CASPs "shall be prohibited from keeping …
  anonymous crypto-asset accounts as well as any account otherwise allowing for the anonymisation
  of the customer account holder or the anonymisation or increased obfuscation of transactions,
  including through anonymity-enhancing coins". The recital says the prohibition "does not apply to
  providers of hardware and software or providers of self-hosted wallets insofar as they do not
  possess access to or control over those crypto-asset wallets". Applies from **10 July 2027**
  ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1624)). Whether
  *amount-only* confidentiality with public counterparties and an auditor key counts as "increased
  obfuscation of transactions": [UNKNOWN], needs counsel.
- **US, Tornado Cash:** OFAC removed the sanctions on 2025-03-21
  ([Treasury](https://home.treasury.gov/news/press-releases/sb0057)), after the Fifth Circuit held
  on 2024-11-26 in *Van Loon v. Treasury* that immutable smart contracts are not "property" under
  IEEPA ([summary](https://www.venable.com/insights/publications/2025/04/a-legal-whirlwind-settles-treasury-lifts-sanctions)).
  Separately, developer Roman Storm was convicted on 2025-08-06 of conspiring to operate an
  unlicensed money-transmitting business; the jury deadlocked on money laundering and sanctions
  counts ([CoinDesk](https://www.coindesk.com/policy/2025/08/06/roman-storm-guilty-of-unlicensed-money-transmitting-conspiracy-in-partial-verdict);
  the [DOJ SDNY release](https://www.justice.gov/usao-sdny/pr/founder-tornado-cash-crypto-mixing-service-convicted-knowingly-transmitting-criminal)
  did not render through my fetcher, so I cite it by title only).
  Current status of post-trial motions: [UNKNOWN].
- **Design implication:** models that keep counterparties public and offer an audit path
  (Confidential Balances with an auditor, Custom Rings with auditor visibility, Private Channels
  with operator audit) are positioned very differently from anonymity pools. A policy vault with an
  owner-held key and an allowlist of known providers sits at the conservative end.

---

## Q6. Recommendation

### Verdict: go with changes

Use Token-2022 confidential transfers as XERO's layer for **amount and balance** privacy, with
policy enforced on encrypted amounts as prototyped. But:

1. **Don't do one confidential transfer per API call.** At 11 transactions, ~483k CU, ~4.5 s and
   one-in-flight per vault [VERIFIED], per-request sub-dollar payments don't fit. Pay providers
   confidentially **per batch or per period** (prepaid credit or periodic settlement), so each
   on-chain confidential payment is dollars, not cents. Per-call metering then stays off-chain
   between agent and provider.
2. **Not on USDC.** Classic SPL Token has no extensions [VERIFIED]. The realistic assets are
   PYUSD/USDG, which need issuer approval per account plus `xero_policy` support for their
   extensions, or a wrapper mint with its own trust model.
3. **Re-evaluate against Custom Rings once they reach mainnet.** Helius documents one-transaction
   private transfers, transfer limits and auditor visibility in custom rings, and names agentic
   commerce as a use case [READ]. If that holds after its audits, it could replace most of the Q4
   machinery. Today it is devnet beta [READ].
4. **Prototype MagicBlock's Private Payments API next to this, for the per-call path.** It is
   documented as live in beta on mainnet for USDC, with an MCP server aimed at agents [READ]. The
   trade-off is a hardware (TDX) and operator trust model instead of pure cryptography, and I did not
   test it.

### Proposed "private policy vault v2"

**Accounts**

| Account | Owner | Contents | Public? |
| --- | --- | --- | --- |
| `Policy` PDA `["policy", owner, spender]` | vault program | owner, spender, `max_per_payment`, `daily_limit`, `window_start`, `Enc(total)` (under the vault key), allowlist, paused | Everything except the running total, which is a ciphertext. Limits could also be stored encrypted [UNKNOWN, not prototyped]. |
| Vault token account | Token-2022, **authority = Policy PDA** | confidential-transfer extension: `Enc(available)`, `Enc(pending)`, AES copy, vault ElGamal pubkey | ciphertexts only |
| Provider token accounts | providers | confidential-transfer extension; providers apply their own pending balances | ciphertexts only |
| Proof context and record accounts | proof program / spl-record | per payment; created and closed inside the payment (rent refunded) | proof statements (ciphertexts, commitments, ElGamal pubkeys) |

**Keys**

| Key | Held by | Purpose |
| --- | --- | --- |
| Owner wallet | owner | Create policy, change limits/allowlist, pause, withdraw, close |
| Spender (agent) wallet | agent | Sign `Pay` |
| Vault ElGamal + AES keys | owner and agent | Derived with `ConfidentialKeys` from an owner signature over `pdaWalletPublicSeed(program, policy, mint, vault)` [READ], then given to the agent (option C). Owner can always re-derive to audit or recover; agent rotation means a new policy/vault. |
| Mint auditor | mint authority (issuer) | Sees transfer amounts, not balances [VERIFIED] |

**One payment**

1. Agent SDK decrypts the vault balance (AES) and the policy's `Enc(total)` (ElGamal) and runs
   `check()` locally, as today, plus "can I build non-negative range proofs".
2. It generates the transfer proofs (equality, 3-handle validity, U128 range) and the policy proofs
   (2 equalities, U128 range): ~50–100 ms native [VERIFIED]; the WASM range proofs alone take
   110–150 ms each [VERIFIED].
3. It verifies them into 5 context accounts (2 range proofs via record accounts): 10 transactions,
   partly parallelizable.
4. `Pay` (signed by the agent): paused check, allowlist on the destination owner, policy-proof
   checks bound to the transfer's validity context, update `Enc(total)`, CPI `Transfer` signed by
   the PDA. Close contexts and records for a rent refund.
5. Provider applies its pending balance when convenient.

**What the chain can and cannot see**

| Visible | Hidden |
| --- | --- |
| Program id (so "this is a XERO vault"), policy PDA, vault, spender signature, owner (from the PDA and the policy account) | Payment amounts |
| Provider token accounts and owners, i.e. who the agent pays | Vault balance, provider balances |
| Mint, time and frequency of payments, number of incoming credits per account | Daily running total |
| Policy parameters (max, daily, allowlist) in plaintext, unless also encrypted | |
| Deposit and withdraw amounts (public ↔ confidential conversions) | |
| Fee payer, context and record accounts, ElGamal pubkeys | |

### Honest limitations: what it will NOT hide

- **Who pays whom and when.** Counterparties, timing and frequency are public. That is enough to
  profile an agent.
- **Amounts by inference.** Deposits and withdrawals are public. If a provider has a public price
  list, an observer can often infer amounts from call patterns. The provider always knows what it
  was paid.
- **From the issuer.** On an issuer-controlled mint, the auditor (if set) sees every transfer amount.
- **From key holders.** Anyone holding the vault key (owner, agent, any former agent under option
  C) sees everything about the vault.
- **Correctness without enforcement.** A key holder can pay any amount unless the program requires
  the policy proofs on every path. Every future instruction that moves funds must keep that
  invariant.

### Rough effort (one engineer familiar with the codebase)

| Work item | Estimate |
| --- | --- |
| Vault program v2 in Anchor (port `ct-vault`, owner withdraw/close paths with the same guarantees, extension handling for the target mint), tests on localnet with mainnet binaries | 3–5 weeks |
| TypeScript proof orchestration on `@solana/zk-sdk` WASM (no upstream transfer helper exists), record-account chunking, parallel submission, retries on `Balance mismatch` | 2–3 weeks |
| Key derivation/custody (`ConfidentialKeys`), SDK API, docs | 1–2 weeks |
| External audit (program + cryptographic binding) | lead time and cost [UNKNOWN] |

Roughly **2–3 engineer-months before audit**. This is a rough estimate, not a plan.

### Riskiest unknowns

1. **Mainnet latency and landing rate** for 11 dependent transactions under real congestion and
   priority fees. Measured only on localnet.
2. **Kill-switch risk.** The proof program has had two soundness bugs and was disabled for about a
   year, during which confidential balances could not be moved [READ]. Owners need a plan for
   funds stuck behind a disabled program.
3. **Asset availability.** No confidential USDC. PYUSD/USDG need issuer approval per account; does
   the issuer approve program-owned vaults at scale? [UNKNOWN]. Does fee-config force
   `TransferWithFee`? [UNKNOWN].
4. **Binding soundness of the policy proofs.** The prototype's binding (reading the amount from the
   same validity context the CPI consumes) worked against the attacks I tried; it has not been
   reviewed by a cryptographer.
5. **Regulatory treatment** of amount-confidential payments under EU AMLR Art. 79 from July 2027.
6. **Rings** could make much of this obsolete (or be the better base) once audited and on mainnet.

---

## Artifacts

| Path | What |
| --- | --- |
| `protocol/spikes/README.md` | How to run everything |
| `protocol/spikes/ct-spike/localnet.sh` | 4.3.0 localnet with mainnet Token-2022 and spl-record binaries (+ optional spike programs) |
| `protocol/spikes/ct-spike/src/bin/q1_simulate.rs`, `out-q1.log` | Read-only proof-program simulation on devnet/mainnet |
| `protocol/spikes/ct-spike/src/bin/q2_transfer.rs`, `out-q2.log`, `out/q2-*.json` | Q2 transfer, costs, observer and auditor views |
| `protocol/spikes/ct-vault/` | Q3/Q4 vault program (native, not audited, do not reuse) |
| `protocol/spikes/ct-spike/src/bin/q3_vault.rs`, `out-q3.log` | Q3/Q4 driver: payments, attacks, concurrency, decryption |
| `protocol/spikes/js-zk/proofs.mjs`, `out-js.log` | JS/WASM proof generation and on-chain verification |
