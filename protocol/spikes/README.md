# Privacy spike prototypes (throwaway)

Research code for [`../docs/privacy-spike.md`](../docs/privacy-spike.md). **Localnet only, not
audited, not for reuse.** Nothing here is part of `xero_policy` or `@xero/sdk`, and none of it is
in the protocol's Anchor workspace.

| Directory | What |
| --- | --- |
| `ct-spike/` | Rust drivers (Q1–Q4) and `localnet.sh` |
| `ct-vault/` | Native Solana program: PDA-owned confidential vault with policy checks on encrypted amounts (Q3/Q4) |
| `js-zk/` | JS/TS check: WASM proof generation with `@solana/zk-sdk`, verified by the proof program (Q1) |

## Requirements

- **Agave 4.3.0** installed side by side (your default CLI can stay as it is):
  ```sh
  D=~/.local/share/solana/install/releases/v4.3.0 && mkdir -p $D && cd $D
  curl -sSfL https://github.com/anza-xyz/agave/releases/download/v4.3.0/solana-release-x86_64-unknown-linux-gnu.tar.bz2 | tar xj
  ```
  `localnet.sh` and the build commands below use it via `$AGAVE_BIN` (default: that path).
- rustc 1.97.1: pinned by each crate's `rust-toolchain.toml`; rustup installs it on first build.
- Node 24 for `js-zk/`.

## Run

```sh
# 1. Build the vault program
cd ct-vault && ~/.local/share/solana/install/releases/v4.3.0/solana-release/bin/cargo-build-sbf && cd ..

# 2. Start localnet (:8999): mainnet Token-2022 + spl-record binaries (dumped read-only into
#    ct-spike/.programs/ on first run) plus the vault program
cd ct-spike
SPIKE_PROGRAMS="AYDFEPAC4vyXZW4MpTxLA5DA1zwKdqqEX19UJoiEVTHa=../ct-vault/target/deploy/ct_vault.so" ./localnet.sh

# 3. In another terminal
cd ct-spike && cargo build --release
./target/release/q1_simulate    # read-only simulateTransaction on devnet + mainnet (sends nothing)
./target/release/q2_transfer    # Q2: confidential transfer, costs, observer/auditor views -> out/
./target/release/q3_vault       # Q3/Q4: vault payments, policy enforcement, attacks, concurrency

cd ../js-zk && npm install && node proofs.mjs   # Q1: JS/WASM proofs, verified on localnet
```

The committed `out-*.log` files and `ct-spike/out/*.json` are the outputs quoted in the doc
(2026-09-24). Keys in them are throwaway localnet keys.

## Notes

- The spike talks JSON-RPC directly (via `curl`) because `spl-token-client` 0.19.1 does not
  compile against the `solana-rpc-client` 4.3.0 that Cargo resolves for it.
- `js-zk/package.json` pins `undici-types` to 7.16.0 because 8.11.1's tarball returned 404 on
  2026-09-24.
- `q1_simulate` names funded system accounts (the Token-2022 upgrade authorities) as simulated fee
  payers. With `sigVerify: false` nothing is signed or charged.
