/**
 * Test fixture: a throwaway solana-test-validator with the real xero_policy program loaded from
 * ../protocol/target/deploy (run `npm run build` in protocol/ first), plus helpers to fund
 * wallets, create a 6-decimal test mint and count the transactions a client sends.
 *
 * Set XERO_TEST_RPC to reuse a running validator that already has the program deployed.
 */
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, type PublicKey } from "@solana/web3.js";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { XERO_POLICY_PROGRAM_ID, XeroClient, keypairWallet, parseAmount } from "../src/index.js";

const PROGRAM_SO = new URL("../../protocol/target/deploy/xero_policy.so", import.meta.url).pathname;
export const DECIMALS = 6;

export interface Localnet {
  rpcUrl: string;
  stop(): Promise<void>;
}

export async function startLocalnet(): Promise<Localnet> {
  if (process.env.XERO_TEST_RPC) {
    return { rpcUrl: process.env.XERO_TEST_RPC, stop: async () => {} };
  }
  if (!existsSync(PROGRAM_SO)) {
    throw new Error(`${PROGRAM_SO} not found; run \`npm run build\` in protocol/ first`);
  }
  const base = Number(process.env.XERO_TEST_PORT ?? 28899);
  const ledger = mkdtempSync(join(tmpdir(), "xero-sdk-ledger-"));
  const validator: ChildProcess = spawn(
    "solana-test-validator",
    [
      "--ledger",
      ledger,
      "--reset",
      "--quiet",
      "--bpf-program",
      XERO_POLICY_PROGRAM_ID.toBase58(),
      PROGRAM_SO,
      "--rpc-port",
      String(base),
      "--faucet-port",
      String(base + 1100),
      "--gossip-port",
      String(base + 1101),
      "--dynamic-port-range",
      `${base + 1102}-${base + 1140}`,
    ],
    { stdio: "ignore" },
  );
  const rpcUrl = `http://127.0.0.1:${base}`;
  const connection = new Connection(rpcUrl, "confirmed");
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (validator.exitCode !== null) throw new Error(`validator exited with ${validator.exitCode}`);
    try {
      if (
        (await connection.getSlot()) > 0 &&
        (await connection.getAccountInfo(XERO_POLICY_PROGRAM_ID))
      ) {
        break;
      }
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error("validator did not start within 60s");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return {
    rpcUrl,
    stop: async () => {
      validator.kill("SIGTERM");
      await new Promise((resolve) => validator.once("exit", resolve));
      rmSync(ledger, { recursive: true, force: true });
    },
  };
}

/** A Connection that counts sendRawTransaction calls, to prove when nothing was sent. */
export function countingConnection(rpcUrl: string): Connection & { sent: number } {
  const connection = new Connection(rpcUrl, "confirmed") as Connection & { sent: number };
  connection.sent = 0;
  const send = connection.sendRawTransaction.bind(connection);
  connection.sendRawTransaction = (...args) => {
    connection.sent++;
    return send(...args);
  };
  return connection;
}

export async function fund(connection: Connection, who: PublicKey, sol: number) {
  const signature = await connection.requestAirdrop(who, sol * LAMPORTS_PER_SOL);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
}

/**
 * The website's cast: an owner with 1,000 test dollars, an agent (the spender), and three
 * providers that each have a token account: data.api and compute.api (to be allowlisted) and
 * unknown.api (never allowlisted).
 */
export async function world(rpcUrl: string, tokenProgram: PublicKey = TOKEN_PROGRAM_ID) {
  const connection = countingConnection(rpcUrl);
  const owner = Keypair.generate();
  const agent = Keypair.generate();
  await Promise.all([fund(connection, owner.publicKey, 10), fund(connection, agent.publicKey, 1)]);

  const mint = await createMint(
    connection,
    owner,
    owner.publicKey,
    null,
    DECIMALS,
    undefined,
    undefined,
    tokenProgram,
  );
  const ata = (who: PublicKey) =>
    createAssociatedTokenAccount(connection, owner, mint, who, undefined, tokenProgram);
  const ownerTokens = await ata(owner.publicKey);
  await mintTo(
    connection,
    owner,
    mint,
    ownerTokens,
    owner,
    usd("1000"),
    [],
    undefined,
    tokenProgram,
  );

  const dataApi = Keypair.generate().publicKey;
  const computeApi = Keypair.generate().publicKey;
  const unknownApi = Keypair.generate().publicKey;
  const [dataApiTokens, computeApiTokens, unknownApiTokens] = await Promise.all(
    [dataApi, computeApi, unknownApi].map(ata),
  );

  const xero = new XeroClient({ connection, wallet: keypairWallet(owner) });
  const balance = async (account: PublicKey) =>
    (await getAccount(connection, account, "confirmed", tokenProgram)).amount;

  connection.sent = 0;
  return {
    connection,
    xero,
    owner,
    agent,
    agentWallet: keypairWallet(agent),
    mint,
    ownerTokens,
    dataApi,
    computeApi,
    unknownApi,
    dataApiTokens,
    computeApiTokens,
    unknownApiTokens,
    balance,
  };
}

/** Dollars (a decimal string) in base units of the 6-decimal test mint. */
export const usd = (dollars: string) => parseAmount(dollars, DECIMALS);
