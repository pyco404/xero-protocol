# @xero/sdk

TypeScript client for the [`xero_policy`](../protocol) Solana program: give an AI agent a
token budget it can spend only within the limits you set.

**Localnet only, test tokens only.**

## Quickstart

```ts
import { Connection } from "@solana/web3.js";
import { PolicyViolation, XeroClient, keypairWallet } from "@xero/sdk";

const connection = new Connection("http://127.0.0.1:8899", "confirmed");
const xero = new XeroClient({ connection, wallet: keypairWallet(owner), programId });

// The owner creates and funds a spender for the agent's key, in one transaction.
const spender = await xero.createSpender({
  spender: agentPublicKey,
  mint,
  deposit: "100", // human units, as strings
  maxPerPayment: "5",
  dailyLimit: "20",
  allowedProviders: [dataApi, computeApi],
});

// Payments must be signed by the agent's key, so switch wallets with .as().
const agent = spender.as(keypairWallet(agentKeypair));
const result = await agent.pay({ recipient: dataApi, amount: "0.42" });
// → { status: "settled", signature, amount, spentInWindow, remainingToday, event }
//   amounts are { raw: 420000n, decimal: "0.42" }

try {
  await agent.pay({ recipient: unknownApi, amount: "40" });
} catch (err) {
  if (err instanceof PolicyViolation) console.log(err.code); // "RecipientNotAllowed"
}
```

`programId` is optional and defaults to the localnet ID in the bundled IDL. `recipient` is the
provider's **wallet**. The SDK pays into that wallet's associated token account for the mint
(pass `recipientTokenAccount` to use another account). The provider must already have one.

An agent that only has its own key loads the policy directly:

```ts
const xero = new XeroClient({ connection, wallet: keypairWallet(agentKeypair) });
const agent = await xero.getSpender(ownerPublicKey, agentKeypair.publicKey);
```

## Clusters

`xero_policy` is **live on devnet** at
[`EK8aHDV1rgmoi7aygKCptretPMwQ9b6U293dioDLGZYW`](https://explorer.solana.com/address/EK8aHDV1rgmoi7aygKCptretPMwQ9b6U293dioDLGZYW?cluster=devnet)
(not audited; devnet and localnet only, no mainnet deployment).

```ts
import { CLUSTERS, XeroClient, explorerUrl } from "@xero/sdk";

const connection = new Connection(CLUSTERS.devnet.rpcUrl, "confirmed");
const xero = new XeroClient({ connection, wallet, cluster: "devnet" });
// ...
console.log(explorerUrl(result.signature, "devnet"));
```

`cluster` selects the program ID (`"localnet"` by default; both clusters use the same ID).
`CLUSTERS.devnet.rpcUrl` is Solana's public devnet endpoint, which rate-limits (HTTP 429); web3.js
retries automatically, but use your own RPC provider for anything beyond trying it out.

## Run the demo

The website demo, run for real, printing each step:

```sh
npm install
XERO_CLUSTER=devnet npm run demo           # devnet; prints explorer links
npm run demo                               # localnet, http://127.0.0.1:8899
RPC_URL=http://127.0.0.1:8999 npm run demo # another local validator
```

The demo uses `~/.config/solana/id.json` (override with `WALLET`) as the owner; on devnet it needs
about 0.1 devnet SOL. It creates a fresh 6-decimal test token every run, never a real stablecoin,
and refuses any RPC URL that isn't localhost (localnet) or a devnet endpoint (devnet).

## API

### `new XeroClient({ connection, wallet, programId?, commitment? })`

`wallet` is anything with `publicKey`, `signTransaction` and `signAllTransactions`, such as
Anchor's `Wallet`, a wallet adapter or `keypairWallet(keypair)`. It signs and pays fees for
everything the client sends. `commitment` defaults to `"confirmed"`.

| Method                          | Does                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `createSpender(options)`        | Creates the policy (and deposits, if `deposit` is set) with the wallet as owner |
| `getSpender(owner, spender)`    | Loads an existing policy; throws `XeroError` `PolicyNotFound`                   |
| `policyAddress(owner, spender)` | The policy PDA                                                                  |
| `vaultAddress(policy)`          | The vault PDA                                                                   |

`createSpender` checks limits (`0 < maxPerPayment <= dailyLimit`) and the allowlist (at most
8, no duplicates) locally before sending.

### `Spender`

| Member                                           | Signer  | Returns                                                   |
| ------------------------------------------------ | ------- | --------------------------------------------------------- |
| `pay({ recipient, amount }, options?)`           | spender | `PaymentResult`                                           |
| `check({ recipient, amount })`                   | none    | `{ allowed: true }` or `{ allowed: false, code, reason }` |
| `status()`                                       | none    | `SpenderStatus`                                           |
| `deposit({ amount, from? })`                     | owner   | signature                                                 |
| `withdraw({ amount, destination? })`             | owner   | signature (works while paused)                            |
| `pause()` / `resume()`                           | owner   | signature                                                 |
| `updateLimits({ maxPerPayment, dailyLimit })`    | owner   | signature                                                 |
| `addProvider(wallet)` / `removeProvider(wallet)` | owner   | signature                                                 |
| `close({ destination? })`                        | owner   | signature                                                 |
| `as(wallet)`                                     |         | the same policy, signed by `wallet`                       |
| `policy`, `vault`, `owner`, `spender`, `mint`    |         | addresses and mint info                                   |

`withdraw` and `close` default to the owner's associated token account and create it if it's
missing. `close` sweeps whatever is left in the vault, then closes the vault and the policy
and refunds their rent to the owner.

`status()` returns `balance`, `limits`, `allowlist`, `paused`, `spentInWindow`,
`remainingToday` and `nextReleaseAt` (when the oldest counted payment stops counting and frees
budget, or `null` if nothing is counted). `remainingToday` counts the daily limit only, not the
vault balance.

### The daily limit: a rolling 24-hour window

The program keeps 24 hourly buckets. Each payment is added to the bucket for its hour
(`unix time / 3600`), and a payment is allowed only if the current hour's bucket plus the 23
before it, plus the amount, stay within `dailyLimit`. A payment therefore counts against the limit
until the 24th hour boundary after it was made: for at least 23 and at most 24 hours. There is no
reset moment, so the limit can't be doubled by spending on both sides of one.
`spentInWindow`, `remainingToday` and `nextReleaseAt` are computed with the same bucket logic as
the program, using the cluster clock.

### `check()` and `pay()`

`check()` reads the policy, vault, recipient account and the cluster clock in one RPC call and
runs the program's checks in the program's order: paused → allowlist → amount (zero, max per
payment) → daily limit over the last 24 hourly buckets. It then checks the vault balance, which on chain is the
token program's job. It never sends a transaction. The program remains the source of truth.
`check()` exists for fast feedback and UI.

`pay()` runs `check()` first and throws `PolicyViolation` (`source: "check"`) without sending
anything if it fails. If the chain still rejects the payment (state changed in between, or you
passed `{ skipCheck: true }`), the program error is mapped to the same `PolicyViolation`
(`source: "chain"`, with the transaction `logs`).

| `PolicyViolation.code`    | Meaning                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `Paused`                  | The owner paused the policy                                    |
| `RecipientNotAllowed`     | The recipient account's owner is not on the allowlist          |
| `ZeroAmount`              | Amount is zero                                                 |
| `AmountExceedsMaxPayment` | Amount is over `maxPerPayment`                                 |
| `DailyLimitExceeded`      | Amount would take the last 24 hourly buckets over `dailyLimit` |
| `InsufficientFunds`       | The vault holds less than the amount                           |

### Errors

All SDK errors extend `XeroError`, which has a string `code`:

- `PolicyViolation`: a payment the policy refuses (above).
- `InvalidAmountError` (`InvalidAmount`): a malformed amount.
- `XeroProgramError`: any other program or Anchor error, e.g. `Unauthorized`,
  `InvalidLimits`, `UnsupportedMint`, `DuplicateProvider`, with `errorNumber` and `logs`.
- `XeroTransactionError`: a failure the SDK can't attribute to the program.
- `XeroError` with codes `PolicyNotFound`, `MintNotFound`, `RecipientAccountMissing`,
  `RecipientMintMismatch`, `Unauthorized` (wrong wallet for the action), `InvalidLimits`,
  `AllowlistFull`, `DuplicateProvider`. All of these are raised locally, before anything is
  sent.

### Amounts

Amounts are decimal strings in human units (`"0.42"`) or bigint base units (`420000n`). Numbers
are rejected, since floating point can't represent most decimal amounts. Strings must be plain
non-negative decimals (`/^\d+(\.\d+)?$/`) with no more fractional digits than the mint's
`decimals`, and must fit in a u64. Results come back as `{ raw: bigint, decimal: string }`, with
trailing zeros trimmed (`"3"`, not `"3.000000"`).

`parseAmount(input, decimals)` and `formatAmount(raw, decimals, options?)` are exported. For
display, `formatAmount(raw, 6, { minFractionDigits: 2 })` pads to two places (`"4.20"`) but never
rounds, so digits past the second are kept (`"4.205"`).

### Events

`parsePaymentSettled(logs, programId?)` extracts the `PaymentSettled` events (`policy`,
`spender`, `mint`, `recipient`, `recipientTokenAccount`, `amount`, `spentInWindow`, `dailyLimit`,
`timestamp`; amounts in base units) from a transaction's
log messages. `pay()` uses it to build its result.

## Development

```sh
npm install
npm test          # unit tests + integration tests against a throwaway solana-test-validator
npm run build     # ESM + .d.ts into dist/
npm run typecheck # src, tests and examples
npm run lint
npm run sync-idl  # copy protocol/target/{idl,types} into src/idl
npm run check-idl # fail if src/idl differs from protocol/target
```

### Keeping the IDL in sync

The SDK ships its own copy of the program's IDL and types in `src/idl/`, because
`protocol/target/` is not committed. After any change to the program:

```sh
cd ../protocol && npm run build   # regenerates target/idl and target/types
cd ../sdk && npm run sync-idl     # copies them into src/idl
```

`npm run build` and `npm test` both fail if `src/idl/` is out of sync with a built
`protocol/target/`. The check is skipped when `protocol/` hasn't been built.

The integration tests load the real program from `../protocol/target/deploy/xero_policy.so`
(run `npm run build` in `protocol/` first) into a validator of their own on port 28899
(`XERO_TEST_PORT` to change it). Set `XERO_TEST_RPC` to use an already running validator that
has the program deployed instead.

The SDK uses `@solana/web3.js` v1, the library the Anchor TypeScript client is built on, so
Anchor's instruction builders, coders and event parser work without an adapter layer. No
`@solana/kit` types appear in the API.
