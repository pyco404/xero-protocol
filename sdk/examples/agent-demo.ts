/**
 * The xero.dev website demo, for real, against a local validator:
 *
 *   an owner gives an AI agent $100 with a $5 max payment and a $20 daily limit,
 *   the agent pays data.api and compute.api four times,
 *   then tries to send $40 to unknown.api, which the SDK refuses before anything is sent.
 *
 * Needs a local validator with xero_policy deployed (see protocol/README.md), and a funded
 * wallet at ~/.config/solana/id.json. Uses a fresh 6-decimal test mint every run.
 *
 *   npm run demo                               # http://127.0.0.1:8899
 *   RPC_URL=http://127.0.0.1:8999 npm run demo # any other local validator
 */
import {
  createAssociatedTokenAccount,
  createMint,
  getAssociatedTokenAddressSync,
  mintTo,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
  PolicyViolation,
  type SpenderStatus,
  type TokenAmount,
  XeroClient,
  formatAmount,
  keypairWallet,
  parseAmount,
} from "@xero/sdk";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const WALLET = process.env.WALLET ?? `${homedir()}/.config/solana/id.json`;

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(RPC_URL)) {
  throw new Error(`agent-demo is localnet only; refusing to run against ${RPC_URL}`);
}

const step = (n: number, text: string) => console.log(`\n${n}. ${text}`);
/** Dollars for display: always two decimals, exact beyond that (the test mint has 6). */
const usd = (amount: TokenAmount | bigint) =>
  `$${formatAmount(typeof amount === "bigint" ? amount : amount.raw, 6, { minFractionDigits: 2 })}`;
const show = (s: SpenderStatus) =>
  console.log(
    `   vault ${usd(s.balance)} · spent today ${usd(s.spentInWindow)} · ` +
      `left today ${usd(s.remainingToday)} · paused ${s.paused}`,
  );

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const owner = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(WALLET, "utf8"))));
  const agent = Keypair.generate();
  const providers = {
    "data.api": Keypair.generate(),
    "compute.api": Keypair.generate(),
    "unknown.api": Keypair.generate(),
  };
  const dataApi = providers["data.api"].publicKey;
  const computeApi = providers["compute.api"].publicKey;
  const unknownApi = providers["unknown.api"].publicKey;
  const name = new Map(Object.entries(providers).map(([k, v]) => [v.publicKey.toBase58(), k]));

  console.log(`cluster ${RPC_URL}`);
  console.log(`owner   ${owner.publicKey.toBase58()}`);
  console.log(`agent   ${agent.publicKey.toBase58()}`);

  step(1, "Setting up a test USD token (6 decimals) and provider token accounts");
  const mint = await createMint(connection, owner, owner.publicKey, null, 6);
  const ownerTokens = await createAssociatedTokenAccount(connection, owner, mint, owner.publicKey);
  await mintTo(connection, owner, mint, ownerTokens, owner, parseAmount("1000", 6));
  for (const provider of Object.values(providers)) {
    await createAssociatedTokenAccount(connection, owner, mint, provider.publicKey);
  }
  // The agent signs and pays the fees for its own payments.
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: agent.publicKey,
        lamports: 0.05 * LAMPORTS_PER_SOL,
      }),
    ),
    [owner],
  );
  console.log(`   mint ${mint.toBase58()}; owner holds $1000`);

  step(2, "Owner creates a spender: $100 budget, $5 max payment, $20/day, data.api + compute.api");
  const xero = new XeroClient({ connection, wallet: keypairWallet(owner) });
  const spender = await xero.createSpender({
    spender: agent.publicKey,
    mint,
    deposit: "100",
    maxPerPayment: "5",
    dailyLimit: "20",
    allowedProviders: [dataApi, computeApi],
  });
  console.log(`   policy ${spender.policy.toBase58()}`);
  show(await spender.status());

  step(3, "Agent pays for API calls");
  const asAgent = spender.as(keypairWallet(agent));
  for (const [recipient, amount] of [
    [dataApi, "0.42"],
    [computeApi, "1.20"],
    [dataApi, "0.80"],
    [computeApi, "3.00"],
  ] as const) {
    const result = await asAgent.pay({ recipient, amount });
    console.log(
      `   ${usd(result.amount)} → ${name.get(recipient.toBase58())}: ${result.status} · ` +
        `spent ${usd(result.spentInWindow)} · left today ${usd(result.remainingToday)} · ` +
        `${result.signature.slice(0, 16)}…`,
    );
  }

  step(4, "Agent tries $40 → unknown.api");
  const check = await asAgent.check({ recipient: unknownApi, amount: "40" });
  console.log(`   check(): ${JSON.stringify(check)}`);
  try {
    await asAgent.pay({ recipient: unknownApi, amount: "40" });
    throw new Error("expected the $40 payment to be refused");
  } catch (err) {
    if (!(err instanceof PolicyViolation)) throw err;
    console.log(`   pay() threw PolicyViolation ${err.code}: ${err.message}`);
    console.log(`   refused by the local check (source: ${err.source}); no transaction was sent`);
  }

  step(5, "Final state");
  const status = await spender.status();
  show(status);
  const balance = async (who: typeof dataApi) =>
    usd(
      BigInt(
        (await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(mint, who))).value
          .amount,
      ),
    );
  console.log(
    `   data.api ${await balance(dataApi)} · compute.api ${await balance(computeApi)} · ` +
      `unknown.api ${await balance(unknownApi)}`,
  );
  console.log(`   window resets at ${status.windowResetsAt?.toISOString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
