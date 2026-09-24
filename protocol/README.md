# XERO protocol

Solana programs for XERO. Phase 1 contains a single Anchor program, `xero_policy`: a
policy-controlled token vault that a **spender** (typically an AI agent's key) can pay from within
owner-defined limits. Amounts are public in this phase. There is no privacy or ZK yet.

**Localnet only, test tokens only.**

The TypeScript client lives in [`../sdk`](../sdk).

## Program: `xero_policy`

Program ID (localnet): `EK8aHDV1rgmoi7aygKCptretPMwQ9b6U293dioDLGZYW`

| Account  | Seeds                        | Purpose                                                |
| -------- | ---------------------------- | ------------------------------------------------------ |
| `Policy` | `["policy", owner, spender]` | Limits, allowlist (max 8), pause flag, spend window    |
| Vault    | `["vault", policy]`          | Token account for `mint`, authority = the `Policy` PDA |

| Instruction                                                         | Signer  | Notes                                                                    |
| ------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| `create_policy(spender, max_per_payment, daily_limit, allowlist)`   | owner   | Creates the policy and vault; validates limits and mint                  |
| `deposit(amount)`                                                   | owner   | Owner token account → vault                                              |
| `update_limits(max_per_payment, daily_limit)`                       | owner   | Same validation as `create_policy`                                       |
| `add_provider(pubkey)` / `remove_provider(pubkey)`                  | owner   | No duplicates, max 8                                                     |
| `set_paused(bool)`                                                  | owner   | Kill switch for `pay`                                                    |
| `pay(amount)`                                                       | spender | Vault → allowlisted provider's token account; emits `PaymentSettled`     |
| `withdraw(amount)`                                                  | owner   | Works while paused                                                       |
| `close_policy()`                                                    | owner   | Sweeps the vault to a token account, closes vault + policy, refunds rent |

`pay` checks, in order: not paused, recipient owner allowlisted, `0 < amount <= max_per_payment`,
then the daily limit over a **rolling 24-hour window of hourly buckets**:

- Each payment is added to the bucket for its hour (`unix_timestamp / 3600`). The policy keeps the
  last 24 buckets (`buckets[hour % 24]`, plus `last_hour`); buckets that fall out of the window are
  cleared on the next payment.
- A payment is allowed only if the sum of the current hour's bucket and the 23 before it, plus the
  amount, is at most `daily_limit`. So an amount counts against the limit until the 24th hour
  boundary after it was paid: for at least 23 and at most 24 hours.
- There is no reset moment, so spending can never exceed `daily_limit` within any 23-hour span
  (the old fixed window allowed up to 2× across a window boundary).

Every instruction emits an Anchor event: `PolicyCreated`, `Deposited`, `PaymentSettled` (policy,
spender, mint, recipient wallet and token account, amount, `spent_in_window`, `daily_limit`,
`timestamp`), `Withdrawn`, `LimitsUpdated`, `ProviderAdded`, `ProviderRemoved`, `PauseChanged` and
`PolicyClosed`.

`Policy` starts with a `version` byte (currently 1) and ends with 64 reserved bytes for future
fields.

Limits must satisfy `0 < max_per_payment <= daily_limit`, otherwise `InvalidLimits`.

Token accounts use `anchor_spl::token_interface`, so SPL Token and Token-2022 mints both work.
Token-2022 mints may only use extensions that don't change transfer amounts or authority
(close authority, metadata and group pointers/data). Anything else, such as transfer fees,
transfer hooks, permanent delegates, confidential transfers or pausable mints, is rejected at
`create_policy` with `UnsupportedMint`.

Errors (Anchor codes): `Paused` 6000, `RecipientNotAllowed` 6001, `AmountExceedsMaxPayment`
6002, `DailyLimitExceeded` 6003, `ZeroAmount` 6004, `AllowlistFull` 6005, `DuplicateProvider`
6006, `Unauthorized` 6007, `MathOverflow` 6008, `ProviderNotFound` 6009, `InvalidLimits` 6010,
`UnsupportedMint` 6011.

## Commands

```sh
npm install
npm run build            # anchor build --arch v2 (links the program keypair first, see below)
npm test                 # build, then the LiteSVM test suite (no validator needed)
npm run test:ts          # tests only, against the existing target/deploy/xero_policy.so
npm run deploy:localnet  # deploy with ~/.config/solana/id.json as payer and upgrade authority
npm run smoke            # website example against a live cluster (default http://127.0.0.1:8899)
```

Deploy to a fresh local validator:

```sh
solana-test-validator --reset --mint $(solana-keygen pubkey ~/.config/solana/id.json)
npm run build && npm run deploy:localnet
npm run smoke
```

`deploy:localnet` and `smoke` read `RPC_URL` (default `http://127.0.0.1:8899`). Both pass the
wallet explicitly, so they don't depend on your `solana config` keypair or cluster.

## Program keypair

The program keypair is **not** in the repo. It lives at `~/.config/xero/xero_policy-keypair.json`
(override with `XERO_PROGRAM_KEYPAIR`), and `npm run build` symlinks it into
`target/deploy/`. Without it, Anchor generates a throwaway keypair there: builds and tests still
work, but you can't deploy to `EK8aHDV1…`. On a new machine, either copy the key over or generate
a new one and run `anchor keys sync`.

## Toolchain notes

- **Anchor 1.2.0.** `Anchor.toml` pins `anchor_version = "1.2.0"`, but avm 0.32.1 ignores that
  pin and the machine's global default is 0.32.1, so the npm scripts call
  `$HOME/.avm/bin/anchor-1.2.0` directly. Use that binary (or `avm use 1.2.0`) for raw
  `anchor` commands.
- **Build with `--arch v2`.** Anchor 1.2 defaults to SBPF v3, which devnet and mainnet do not
  support yet (checked 2026-09-24), and which the Agave 3.1 CLI cannot deploy. `npm run build`
  and `npm test` pass the flag; a bare `anchor build` or `anchor test` does not.
- **Wallet.** `Anchor.toml` uses `~/.config/solana/id.json`. `solana-test-validator` funds the
  keypair from your Solana CLI config by default, so pass `--mint` as above if those differ.
- Tests run in LiteSVM, which enables every runtime feature. `npm run smoke` is the check that
  the program runs on a real validator.
- Node 24 strips TypeScript types natively, which bypasses ts-node under mocha. The test and
  smoke scripts set `NODE_OPTIONS=--no-experimental-strip-types` to keep ts-node in charge.
