# Privacy rail evaluation: XERO as a policy layer

Research, 2026-09-24. Direction under evaluation: XERO is the **policy layer for agent money on top
of existing privacy rails**, not a privacy protocol of its own.

Every claim is tagged:

- **[VERIFIED]** I ran code or read chain state myself (mainnet read-only: account and program reads,
  no transactions, no accounts, no API keys).
- **[READ]** From docs, source code or announcements. Linked; fetched 2026-09-24 unless noted.
  "READ (source)" means I read the code in the public repository at the commit named.
- **[UNKNOWN]** Could not determine. Not guessed.

Nothing here required signing up, requesting an API key or joining a waitlist. What access *would*
require is listed per rail.

## Summary

- **Three rails have mainnet payment functionality today:** MagicBlock Private Payments, Umbra and
  Token-2022 confidential transfers [VERIFIED program deployments]. **Helius Rings**, the rail
  whose design is closest to XERO, is **devnet only** [VERIFIED]. **Private Channels** is devnet
  only [VERIFIED]. **Arcium** is on mainnet but is a compute engine, not a payment rail.
- **Rings custom rings already implement most of XERO v1 natively**, enforced inside their proofs:
  per-transfer caps, fixed-window spend caps, co-sign thresholds, allowlists, pause, freeze and a
  mandatory auditor [READ (source)]. On Rings, XERO adds little *unless* it supplies what rings
  lack:
  - **Per-agent** limits. Ring rules apply to every member alike.
  - A policy that the **owner** sets, not the ring operator.
  - Agent-specific semantics.
- **MagicBlock** is the only rail with a documented, working path for a **program-owned (PDA)
  account to move private funds**, on mainnet, with native USDC [READ + VERIFIED deployment]. It
  also has the weakest privacy (the docs themselves say amounts and timing "may still be inferable")
  and a trust model of hardware plus operator, with its custody program upgradeable by **a single
  keypair** [VERIFIED].
- **What XERO uniquely owns:** a rail-agnostic spending policy (per-agent limits, windows,
  allowlists, pause, kill switch) defined once by the owner and enforced the strongest way each
  rail allows. Plus the agent-facing SDK and the "can this agent pay this?" check. XERO does *not*
  own privacy.
- **Integrate first:** keep the **public vault** (it works). Add **MagicBlock** as the first
  private rail, with on-chain enforcement via a XERO program owning an eATA. Prototype **Rings** on
  devnet in parallel and decide per-agent enforcement there once its mainnet date and ring
  activation terms are known.

---

## Rails in scope

| Rail | Included because |
| --- | --- |
| Public `xero_policy` vault | XERO's existing rail; must stay supported |
| Token-2022 confidential transfers | Native Solana baseline; already prototyped (see [privacy-spike.md](privacy-spike.md)) |
| Helius Rings / Solana Privacy Protocol | Solana's documented "programmable privacy" model; closest design to XERO |
| MagicBlock Private Payments | Mainnet, USDC, agent-oriented (MCP) |
| Solana Foundation Private Channels | Solana's documented institutional model |
| Arcium | Mainnet encrypted-compute network; possible policy engine |
| **Umbra** (added) | Mainnet rail on Arcium with USDC/USDT support [VERIFIED program; READ tokens] |
| Hinkal (screened only) | Multi-chain payments-privacy SDK that added Solana in 2026 [READ, trade press]. No public Solana program ID or policy interface found in its SDK intro; proofs, routing and relaying are run by Hinkal. Revisit if a partnership is on the table. |
| Privacy Cash (excluded) | Shielded pool that breaks sender→recipient links, which allowlists need; README: SOL now, SPL "soon" ([GitHub](https://github.com/Privacy-Cash/privacy-cash)) |
| Elusiv (excluded) | Sunset 2024-02-29 |
| Light Protocol ZK compression (excluded) | Scaling, not privacy; the team's privacy work moved into Helius Rings [READ, prior spike] |

---

## 1. Public `xero_policy` vault (existing)

| | |
| --- | --- |
| Status | Program built and tested on localnet (38 tests); SDK with 25 tests [VERIFIED]. Not deployed to devnet or mainnet. |
| Assets | Any SPL mint incl. native USDC; Token-2022 only with benign extensions [VERIFIED] |
| Hidden | Nothing |
| Trust | The Solana program |
| Cost / latency | One transaction per payment [VERIFIED]. CU not measured. |
| Concurrency | Serial per policy account (payments write the same account) |
| Developer access | This repo |
| Enforcement | **On-chain** [VERIFIED] |

This is what the other rails are measured against.

## 2. Token-2022 confidential transfers (baseline, from the spike)

All from [privacy-spike.md](privacy-spike.md) unless noted.

| | |
| --- | --- |
| Status | Mainnet: proof program re-enabled at epoch 982, Token-2022 confidential instructions live since June 2026 [VERIFIED gates; READ dates]. Program `TokenzQd…`, multisig upgrade authority [VERIFIED]. |
| Assets | **Not native USDC** (classic SPL mint). PYUSD/USDG have it initialized but need issuer approval per account [VERIFIED]. |
| Hidden | Amounts and balances. Public: counterparties, owners, timing, deposit/withdraw amounts, credit counts [VERIFIED]. |
| Trust | Pure cryptography (ElGamal, sigma and range proofs); two past soundness bugs [READ] |
| Cost / latency | 6 tx, ~250k CU, 65,000 lamports base fees, 2.6 s localnet; 11 tx / ~483k CU / ~4.5 s with encrypted policy proofs [VERIFIED] |
| Concurrency | **One payment in flight per account** (`Balance mismatch`) [VERIFIED] |
| Developer access | Public Rust crates and `@solana/zk-sdk` (WASM); no JS helper for transfer proofs [VERIFIED] |
| PDA custody | Yes, via CPI with pre-verified proof context accounts [VERIFIED] |
| Co-signer | Any extra signer the controlling program requires [VERIFIED by construction] |
| Built-in policy | None |
| Events / hooks | None beyond transaction logs |
| Auditor | Mint-level auditor key (amounts only, not balances) [VERIFIED] |
| Enforcement | **On-chain** [VERIFIED], at 2× the cost of a plain confidential transfer |
| Overlap with XERO | None: no policy features |

---

## 3. Helius Rings (Solana Privacy Protocol)

**Status**
- **Devnet only.** `sppXZU59…` (privacy program), `regyS5rk…` (user registry) and `trEEbaNo…`
  (state tree) exist on devnet and **not on mainnet** [VERIFIED]. The privacy program was last
  deployed at devnet slot 481,005,012; its upgrade authority is a single keypair (on-curve)
  [VERIFIED].
- "Currently are being audited by three independent security audit firms … the Solana Privacy
  Program will be formally verified" ([addresses](https://www.helius.dev/docs/privacy/addresses)) [READ].
- Source is public: [helius-labs/zolana](https://github.com/helius-labs/zolana), Apache-2.0, last
  push 2026-09-24 [VERIFIED via GitHub API].
- Mainnet date: [UNKNOWN]. Earlier trade press put mainnet at "August", with October 2026 as an
  outer bound (prior spike, not re-checked).

**Assets:** "SOL or any SPL or Token-2022 asset", with a per-mint interface PDA escrowing deposits
([concepts](https://www.helius.dev/docs/privacy/concepts)) [READ]. So native USDC should be
possible in principle. Whether a USDC interface exists on devnet: [UNKNOWN].

**What's hidden and the trust model** [READ, concepts]:
- **Default Ring:** asset and amount are private; sender and recipient are public.
- **Anonymous custom rings:** also hide sender and recipient, via a relayer.
- **Proofs:** Groth16 on-chain. They are "currently generated by a prover server"; "local proving
  for confidential Rings is planned". Today the prover operator therefore sees transaction
  contents: [READ, and inferred from proving remotely].
- **Decryption:** local or delegated, with a viewing key shared with a provider.
- **Ring operators** hold the auditor key and, if configured, a permanent-delegate key.
  README (source): "An operator holding both keys can recover notes as the auditor and move them as
  the delegate."

**Cost, latency and concurrency** [READ, concepts]:
- One Solana transaction per transfer, "approximately 220,000 CU".
- Proving takes "tens of milliseconds" on the prover server.
- Balances split across UTXOs "can be used concurrently".
- Each state tree handles "approximately 54 private transfers per block … ~130 TPS", and more trees
  can be added.
- Fees in lamports or USD: [UNKNOWN].

**Developer access:**
- `@heliuslabs/zolana` (npm, Apache-2.0; docs install `0.2.0-alpha`) and Rust crates from git tags
  [VERIFIED npm; READ docs].
- Devnet RPC needs a Helius API key. A full local stack is available without a key
  (`zolana dev start`) [READ, endpoints].
- **Custom rings need Helius:** creating a ring config is permissionless, but it is created "inert"
  until "governance admits the ring … with `set_ring_activation`" [READ (source)
  `programs/shielded-pool/src/instructions/ring_config/*.rs`, commit `633742e`].
- The docs say "contact us" for custom rings.
- Docs quality: good. Precise privacy tables, a spec, invariants, and worked policy examples.

**Policy attachment**
- **PDA custody:** yes.
  - "Solana programs can own UTXOs" [READ, concepts].
  - Owner authorization is a Solana `is_signer` check, so a PDA signs via CPI [READ (source)
    `transact/account.rs`].
  - Worked examples of PDA-owned escrow notes exist: `sdk-tests/timelock-escrow`,
    `zk-program-swap` [READ (source)].
  - A third-party **"ZK program"** runs its own circuit bound to the transfer via
    `private_tx_hash`, and "non-ring programs use no PDA signer" ([spec](https://github.com/helius-labs/zolana/blob/main/docs/spec.md))
    [READ (source)]. So per-agent **amount** rules on private balances need a custom Groth16
    circuit.
  - Registration of ZK programs: none mentioned; [UNKNOWN] whether any is required.
- **Co-signer:** yes, natively. `zolana-ring cosigner set`, scoped to transfers, deposits or
  withdrawals, with per-mint thresholds [READ (source), custom-rings README].
- **Built-in policy** (custom rings, configured as data in `ring.toml`, enforced in the policy
  circuit and program) [READ (source) `custom-rings/examples`]:
  - `transfer-cap`: per-transfer cap per mint.
  - `velocity-window`: fixed-slot-window cap per sender per mint, with encrypted counters.
  - `cosign_above` thresholds.
  - Sender/recipient allowlists and blocklists, curated lists.
  - Freeze and pause.
  - Public deposit/withdrawal spend windows.
  - Cross-ring rules.
  - **Limitation:** velocity rows are `{asset, cap, cosign_above}` for the whole ring. **No
    per-member limits** [READ (source) `VelocityRowIxData`]. Windows are fixed, not rolling, so a
    burst at a boundary can move up to twice the cap [READ, README].
- **Events and hooks:** webhooks for `private_wallet.transaction_confirmed`,
  `private_wallet.balance_updated` and **`policy.action_required`**; ring reporting API
  ([enterprise](https://www.helius.dev/docs/privacy/integration/enterprise)) [READ].
- **Auditor:** mandatory in custom rings, and bound by proof ("the program accepts no transact
  without that proof"). Users can also share viewing keys [READ (source)].

**Enforcement rating: on-chain** (documented, not tested by me).
- Ring-wide rules: via a custom ring, which needs Helius governance activation.
- Per-agent rules: via a XERO ZK program that owns notes, which needs custom circuits.

**Overlap with XERO: high.** max_per_payment ≈ `transfer-cap`, daily_limit ≈ `velocity-window`,
allowlist, pause and co-sign all exist natively. XERO adds nothing for a single uniform policy
across a ring. XERO adds value only for **per-agent, owner-set** policies and the agent SDK.

## 4. MagicBlock Private Payments (Ephemeral SPL Token + Private Ephemeral Rollup)

**Status**
- **Mainnet and devnet.** `SPLxh1LV…` (Ephemeral SPL Token), `DELeGGvX…` (delegation) and
  `BTWAqWNB…` (permission) are deployed on both [VERIFIED].
- The Ephemeral SPL Token program was last redeployed at mainnet slot 449,971,564, within about a
  day of this check [VERIFIED; current slot 449,994,824].
- **Upgrade authorities** [VERIFIED on-curve checks]: Ephemeral SPL Token and Permission programs
  are **single keypairs** (on-curve); delegation is a PDA (likely multisig).
- **Audits** ([security & audits](https://docs.magicblock.gg/pages/overview/additional-information/security-and-audits))
  [READ]:
  - Delegation program: Halborn.
  - Permission program: "Audit: TBC", GitHub "Currently Private".
  - Ephemeral SPL Token program: **not listed**.
- The payments API reports healthy: `GET https://payments.magicblock.app/health` →
  `{"status":"ok"}` [VERIFIED].
- The API is "in beta on Solana Mainnet and Devnet"
  ([blog](https://www.magicblock.xyz/blog/private-payments-api)) [READ].

**Assets:**
- Any SPL mint for self-paid transfers; gasless mode supports "mainnet USDC/USDT, devnet USDC"
  [READ, private-payments guide].
- The mainnet **USDC** Global Vault PDA exists and holds **147.82 USDC**; the USDT vault holds 0
  [VERIFIED]. Native USDC works. Current usage is tiny.

**What's hidden and the trust model:**
- **Custody:** real tokens sit in a per-mint **Global Vault PDA**. Each user's balance is a `u64`
  "eATA" record delegated to a MagicBlock validator inside an **Intel TDX** enclave [READ].
- **Private transfers:** "not broadcast publicly", can route through stealth handles, and use
  queued settlement with `minDelayMs`/`maxDelayMs` [READ, API reference].
- The docs' own caveat: "Privacy here reduces **linkability**, not total observability. Amounts
  and timing may still be inferable at the network level" [READ].
- **Trust:** TDX hardware with remote attestation, plus the rollup operator, plus a single-key
  upgradeable custody program [VERIFIED key].
- **Compliance by design:** IP geofencing and real-time AML/sanctions screening via Range; "not open
  anonymity rails" ([compliance](https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/introduction/compliance-framework))
  [READ].

**Cost, latency and concurrency** [READ]:
- 0.1% privacy fee on private base→base transfers, in the token.
- Gas self-paid, or gasless for a flat 0.2 USDC/USDT with a 0.5 minimum.
- A one-time ~0.00204 SOL rent the first time.
- Latency "sub-50 millisecond execution" inside the rollup (marketing claim), plus settlement delay
  when queued.
- Concurrency per account: [UNKNOWN].

**Developer access:**
- Hosted REST API that returns **unsigned** transactions (no API key needed to build them); private
  reads need a bearer token from a wallet-signed challenge [READ].
- MCP endpoint for agents [READ].
- Program SDK `@magicblock-labs/ephemeral-rollups-sdk`.
- Source [VERIFIED via GitHub API]: `magicblock-labs/ephemeral-spl-token` is public, Apache-2.0,
  pushed 2026-09-24. The Permission program source is private.

**Policy attachment:**
- **PDA custody:** yes, documented.
  - "a program-owned account, delegated to the ER, with your program signing token transfers as a
    PDA" ([smart contract integration](https://docs.magicblock.gg/pages/ephemeral-spl-token/smart-contract-integration))
    [READ].
  - The API also accepts off-curve PDA owners as `from` [READ].
  - Amounts are plaintext to the program inside the enclave, so XERO's **existing** policy logic
    (max, daily, allowlist, pause) should port almost unchanged. [UNKNOWN until built]: whether
    private-visibility transfers and stealth handles are available from a PDA-signed program path,
    or only through the hosted API.
- **Co-signer:** via the controlling program (any required signer). The gasless sponsor co-signs as
  fee payer [READ].
- **Built-in policy:** none for spending. Access control only (Permission Program groups) plus
  compliance screening [READ].
- **Events and hooks:** transaction signatures and a transfer-queue crank; no webhooks found
  [READ].
- **Auditor:** Permission-program read access for groups (auditors, compliance) [READ].

**Enforcement rating: on-chain** (documented, not tested by me), via a XERO program custodying an
eATA.

**Overlap with XERO: low.** MagicBlock has no spend limits, windows or allowlists. XERO's policy is
additive here.

## 5. Solana Foundation Private Channels

**Status:**
- Escrow program `9tgHa1Dc…` is on **devnet only**, not on mainnet [VERIFIED]. The Withdraw program
  runs inside the channel, not on mainnet.
- Source is public: [solana-private-channels](https://github.com/solana-foundation/solana-private-channels),
  MIT, last push 2026-09-24 [VERIFIED].
- The docs banner says "has not been security audited" ([overview](https://solana.com/docs/tools/private-channels/overview)),
  but the repo contains **OtterSec reports dated 2026-09-02** covering on-chain, off-chain and web2
  components [READ (source) `audits/README.md`]. That is a **documentation discrepancy**.

**Assets:** SPL Token inside the channel. "Token-2022 is **not** admitted at ingress". Native USDC
is fine [READ (source) `docs/CORE.md`].

**What's hidden and the trust model:** transfers inside the channel are not on mainnet; only
deposits and withdrawals are. The operator runs the sequencer and database and sees everything.
Withdrawals are protected by an on-chain Sparse Merkle Tree proof, so "a compromised operator key
alone is not sufficient to drain" [READ]. Trust model: **operator**.

**Cost and latency:** zero per-transfer fee, sub-second confirmation by the sequencer [READ].

**Developer access:** self-hosted. You run an instance (Docker Compose) or integrate against
someone's. JWT auth is optional [READ].

**Policy attachment:**
- **PDA custody inside the channel:** **no.** Only SPL Token, ATA, Memo, System `Transfer`, the
  Withdraw program and a DvP swap program may execute. Other programs "are rejected at the RPC
  layer" [READ (source) `core/src/transactions.rs`, `docs/CORE.md`].
- **Co-signer:** no.
- **Built-in policy:** operator-level only (allowed mints, roles, rate limits per docs) [READ].
- **Events:** a WebSocket streamer; "event schema is not yet publicly documented" [READ].
- **Auditor:** the operator can grant visibility [READ].

**Enforcement rating: none** on a third-party channel. It is operator-enforced only if XERO forks
and runs its own instance (MIT permits it).

**Overlap with XERO:** none, but also no hook for XERO.

## 6. Arcium

**Status:**
- **Mainnet**: `Arcj82pX…` (last deployed at slot 449,975,136) and `ArcStnN9…` [VERIFIED].
- Upgrade authority is a PDA (likely multisig) [VERIFIED].
- Docs: "Arcium is live on Solana mainnet"
  ([llms.txt](https://docs.arcium.com/llms.txt)) [READ].
- v0.15.0 released 2026-09-14 [READ].

**Nature:** encrypted computation (MPC), not a payment rail. The "C-SPL" confidential token appears
nowhere in the current docs index. Its status is [UNKNOWN]; trade press had it for Q1 2026.

**Trust model** [READ]:
- Cerberus, "a dishonest-majority, detect-and-abort protocol".
- Until v0.15.0, preprocessing used a **trusted dealer**. Distributed preprocessing is now
  **opt-in** ([release notes](https://docs.arcium.com/developers/release-notes)).
- Liveness depends on the node cluster.

**Cost, latency and developer access:**
- Two-step flow: queue a computation, then a callback transaction [READ].
- Latency and fees: [UNKNOWN].
- SDK `@arcium-hq/client` is **GPL-3.0-only** [VERIFIED npm]. That licence affects how an SDK that
  links it can be distributed.
- Whether mainnet clusters are permissioned for new MXEs: [UNKNOWN] (docs have a
  "permissioned clusters" page; not read).

**Policy attachment:** as a policy *engine*, an MXE could evaluate limits on encrypted state. It
isn't a rail, though; it needs a token layer such as Umbra or C-SPL.

**Enforcement rating: on-chain** (build-your-own, as the engine behind a rail).

**Overlap with XERO:** none.

## 7. Umbra (on Arcium)

**Status:**
- **Mainnet** `UMBRAD2i…` (last deployed at slot 449,658,657); devnet `DSuKkyqG…` [VERIFIED].
- The mainnet upgrade authority is a **single keypair** (on-curve) [VERIFIED].
- Public since 2026-03 per trade press [READ, The Block].
- Audits: [UNKNOWN], none found in the SDK docs.

**Assets:** mainnet wSOL, **USDC**, **USDT**, UMBRA, CASH, ZINC; devnet wSOL only
([supported tokens](https://sdk.umbraprivacy.com/supported-tokens)) [READ].

**What's hidden and the trust model:**
- **EncryptedTokenAccounts:** balances encrypted by **Arcium MPC** ("MXE-only" or "Shared" with the
  user's X25519 key).
- **Stealth Pool:** a mixer with an Indexed Merkle Tree and Groth16 proofs that unlinks sender and
  recipient
  ([how it works](https://sdk.umbraprivacy.com/concepts/how-umbra-works)) [READ].
- Trust: MPC network plus ZK plus program authority.

**Cost and latency:**
- Protocol fee 35/16,384 ≈ **0.21%** on withdrawals, conversions and pool notes; 0 on
  self-deposit. Relayer fee 0. A per-note SOL fee
  ([pricing](https://sdk.umbraprivacy.com/pricing)) [READ].
- Every MPC operation is two transactions [READ].
- Latency: [UNKNOWN].

**Developer access:** `@umbra-privacy/sdk` 4.0.0, MIT [VERIFIED npm]. Proofs are **client-side**
(snarkjs; proving keys from Umbra's CDN by default) [READ].

**Policy attachment:**
- PDA-owned EncryptedTokenAccounts, or CPI from another program: [UNKNOWN]. Not documented in the
  pages read.
- No built-in limits, allowlists or co-signing [READ].
- Compliance: voluntary viewing keys and X25519 re-encryption grants recorded as on-chain PDAs
  [READ].

**Enforcement rating: client-only** (unless PDA ownership turns out to be supported).

**Overlap with XERO:** none.

---

## Comparison

| Rail | Mainnet | Native USDC | Hides | Trust model | Cost per payment | Concurrent payments per account | PDA custody | Co-signer | Built-in policy | Hooks | Auditor | **Enforcement** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public `xero_policy` vault | Not deployed (localnet) | Yes [V] | Nothing | Program | 1 tx [V] | No | Yes [V] | Yes | XERO's own | Logs, events | n/a | **On-chain** [V] |
| Token-2022 CT | Yes [V] | **No** [V] | Amounts, balances | Crypto | 6 tx, ~250k CU; 11 tx, ~483k CU with policy [V] | **No** [V] | Yes [V] | Yes | None | None | Mint auditor (amounts) [V] | **On-chain** [V] |
| Helius Rings | **No, devnet** [V] | In principle [R] | Asset, amount (+ parties in anonymous rings) | ZK; hosted prover; ring operator | 1 tx, ~220k CU [R] | Yes, via UTXOs [R] | Yes [R src] | Yes, native [R src] | **Caps, windows, co-sign, allow/block lists, pause, freeze** (ring-wide) [R src] | Webhooks incl. `policy.action_required` [R] | Mandatory in custom rings [R src] | **On-chain** [R] |
| MagicBlock Private Payments | Yes [V] | Yes, 147.82 in vault [V] | Linkability; amounts "may be inferable" [R] | TEE (TDX) + operator; single-key upgrade [V] | 0.1% + gas, or 0.2 USDC gasless [R] | [UNKNOWN] | Yes, documented [R] | Via program | None (access control only) | None found | Permission groups [R] | **On-chain** [R] |
| Private Channels | **No, devnet** [V] | Yes, no Token-2022 [R src] | Everything in-channel, from outsiders | Operator | 0 per transfer [R] | n/a | **No**, program allowlist [R src] | No | Operator-level | WebSocket (undocumented schema) [R] | Operator | **None** (operator only if self-run) |
| Arcium | Yes [V] | n/a (engine) | Computation inputs | MPC, dishonest majority; trusted dealer until v0.15 opt-in [R] | [UNKNOWN] | n/a | n/a | n/a | n/a | Callbacks | n/a | On-chain (as engine) |
| Umbra | Yes [V] | Yes [R] | Balances (+ links via pool) | MPC + ZK; single-key upgrade [V] | ~0.21% on exits/notes [R] | [UNKNOWN] | [UNKNOWN] | No | None | None found | Voluntary grants [R] | **Client-only** |

[V] = VERIFIED, [R] = READ, [R src] = READ from source code.

---

## What XERO uniquely owns

Given what the rails already do:

1. **One policy, many rails.** An owner defines an agent's rules once and XERO enforces them on
   whichever rail carries the money. No rail offers this. Each rail's policy (where one exists) is
   its own format, scope and operator.
2. **Per-agent, owner-set policy.** Rings' policies are ring-wide and set by the ring operator;
   MagicBlock and Umbra have none. XERO's model (this owner, this agent, these limits, revocable at
   any time) is not native anywhere.
3. **The agent-side contract:** `check()` before paying, typed `PolicyViolation`s, `status()` with
   remaining budget, and the kill switch. The same semantics regardless of rail.
4. **The public vault**, which already works and needs no privacy rail.

Where XERO adds **nothing**, being blunt:
- **Privacy itself.** That belongs to the rails.
- **A uniform ring-wide policy on Rings.** A custom ring already enforces caps, windows, allowlists
  and co-signing in its proofs. Wrapping that with XERO would duplicate it.
- **Compliance screening** on MagicBlock (already built in) and **auditor visibility** on Rings
  (mandatory, proof-bound).

## Which rails to integrate first

1. **Keep the public vault** as rail #1. It's done and on-chain enforced. It needs a devnet
   deployment.
2. **MagicBlock first** for private payments:
   - The only rail that is **on mainnet with native USDC** *and* documents program (PDA) custody,
     so XERO can keep **on-chain** enforcement with its existing plaintext policy logic.
   - Agent-oriented (MCP).
   - Conditions: accept its hardware/operator trust model and weaker privacy; confirm who controls
     the single-key upgrade authority; confirm that private transfers work from a PDA-signed path.
3. **Rings in parallel on devnet** (local stack, no key needed):
   - It is the strongest *design fit* and could make most of XERO's policy native.
   - Decide there between (a) a XERO-operated custom ring (uniform policy, needs Helius
     activation) and (b) a XERO ZK program for per-agent limits (needs circuits).
   - Ship to users once Rings is on mainnet.
4. **Not now:**
   - Token-2022 CT: no USDC, 11 transactions per policy payment.
   - Private Channels: no program hook, devnet only.
   - Umbra: client-only, until PDA support is confirmed.
   - Arcium: an engine, not a rail.

## SDK sketch: rail-agnostic interface

```ts
const xero = new XeroClient({ connection, wallet });

const spender = await xero.createSpender({
  rail: "public" | "magicblock" | "rings",   // default "public"
  spender: agentPublicKey,
  mint: USDC,
  deposit: "100",
  policy: { maxPerPayment: "5", dailyLimit: "20", allowedProviders: [dataApi, computeApi] },
  railOptions: { /* rail-specific, typed per rail */ },
});

spender.rail;                       // "public" | "magicblock" | "rings"
spender.capabilities;               // { enforcement: "on-chain", hides: ["amount", ...], concurrent: false, ... }
await spender.check({ recipient: dataApi, amount: "0.42" });   // same everywhere
await spender.as(agentWallet).pay({ recipient: dataApi, amount: "0.42" });
await spender.status();             // same shape; rail-specific details under status.rail
```

**Common (XERO core):**
- `PolicyDefinition`: limits, window, allowlist, paused.
- `check()`, evaluated against the policy and the rail's readable state.
- `PolicyViolation` codes.
- `status()` shape, amounts as `TokenAmount`, owner controls (`pause`, `resume`, `updateLimits`,
  `add/removeProvider`, `close`), the `as(wallet)` signing model.
- A `capabilities` object so callers can see what each rail hides and how it enforces.

**Rail-specific (adapter interface):**

```ts
interface RailAdapter {
  id: "public" | "magicblock" | "rings";
  capabilities: RailCapabilities;
  createVault(policy, opts): Promise<VaultRef>;
  readState(vault): Promise<{ balance: bigint; spentInWindow: bigint; windowStart: bigint }>;
  buildPayment(vault, req): Promise<UnsignedTx[]>;      // 1 tx (public), rail-specific otherwise
  mapError(logs): PolicyViolation | XeroError;          // rail errors -> common codes
}
```

What each adapter covers:
- **public:** today's `xero_policy`, unchanged.
- **magicblock:** a XERO program (or an extension of `xero_policy`) owning an eATA. `buildPayment`
  = delegate if needed, then a PDA-signed private transfer. Needs the bearer-token flow for private
  reads.
- **rings:** either a custom-ring config (policy mapped to `ring.toml` rows) or a XERO ZK program.
  `readState` decrypts with the viewing key. Proofs come from the prover service or, later, local
  proving.

Where the policy lives differs per rail. For public and magicblock it's XERO's program. For rings
it's either the ring or a XERO ZK program. `check()` stays client-side everywhere and the rail
stays the source of truth.

## Access needed, and who to contact (public channels only)

| Rail | What we'd need | Public contact |
| --- | --- | --- |
| MagicBlock | Nothing to start (public API returns unsigned transactions; SDK public). For production: confirm PDA-signed private transfers, upgrade-authority governance, audit status of the SPL and Permission programs; possibly a licensed PER instance | Discord / "Builder chat" named in the [Private Payments API post](https://www.magicblock.xyz/blog/private-payments-api); [docs](https://docs.magicblock.gg) |
| Helius Rings | Devnet: a Helius API key (**your decision**), or the local stack (no key). Custom ring: **governance activation** by Helius. Mainnet: their launch | [helius.dev/contact](https://www.helius.dev/contact), sales@helius.xyz and the Telegram link on the [addresses page](https://www.helius.dev/docs/privacy/addresses) |
| Private Channels | None (MIT, self-host) | [GitHub issues](https://github.com/solana-foundation/solana-private-channels/issues), Solana Stack Exchange |
| Umbra | Confirm PDA/CPI support and audits | Their docs site ([sdk.umbraprivacy.com](https://sdk.umbraprivacy.com)); no contact channel read |
| Arcium | Mainnet cluster access terms for new MXEs [UNKNOWN] | [docs.arcium.com](https://docs.arcium.com) |

## Riskiest unknowns

1. **Rings mainnet timing and ring activation terms.** The best-fit rail isn't on mainnet, and
   custom rings need Helius governance.
2. **MagicBlock custody risk.** A single-key upgradeable program holds all deposited funds, and its
   audit isn't listed. Also: do private transfers work from a PDA-signed program path, or only via
   the hosted API?
3. **Per-agent limits on Rings** need either one ring per policy or custom Groth16 circuits. Both
   are costly.
4. **Privacy strength varies widely.** MagicBlock's own docs say amounts and timing may be
   inferable. "Private" must be labelled per rail in the SDK (the `capabilities` object).
5. **Regulation** (EU AMLR Art. 79 from 2027-07-10) treats rails differently. Compliance-first
   rails (MagicBlock, Rings custom rings) may be required for institutional users.
6. **Arcium's GPL-3.0 client** if Umbra or Arcium is ever bundled into the SDK.
