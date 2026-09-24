import {
  type Commitment,
  type Connection,
  SendTransactionError,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { XeroTransactionError, errorFromLogs } from "./errors.js";
import type { XeroWallet } from "./wallet.js";

export interface SendOptions {
  /** Skip the RPC node's simulation, so a failing transaction lands on chain (and pays fees). */
  skipPreflight?: boolean;
  /** Fetch the confirmed transaction's logs (an extra RPC call) and return them. */
  withLogs?: boolean;
}

export interface Sent {
  signature: string;
  /** Empty unless `withLogs` was set. */
  logs: string[];
}

/**
 * Signs `ixs` with `wallet` (also the fee payer), sends and confirms them. Failures, whether
 * caught by the RPC node's simulation or after landing on chain, are rethrown as SDK errors.
 */
export async function sendInstructions(
  connection: Connection,
  wallet: XeroWallet,
  ixs: TransactionInstruction[],
  commitment: Commitment,
  options: SendOptions = {},
): Promise<Sent> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(commitment);
  const tx = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight }).add(
    ...ixs,
  );
  const signed = await wallet.signTransaction(tx);

  let signature: string;
  try {
    signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: options.skipPreflight ?? false,
      preflightCommitment: commitment,
    });
  } catch (err) {
    if (err instanceof SendTransactionError) {
      const logs = err.logs ?? (await err.getLogs(connection).catch(() => [])) ?? [];
      throw errorFromLogs(logs, err.transactionError.message);
    }
    throw err;
  }

  const err = await confirm(connection, signature, lastValidBlockHeight, commitment);
  if (err) {
    throw errorFromLogs(
      await fetchLogs(connection, signature, commitment),
      `transaction ${signature} failed: ${JSON.stringify(err)}`,
      signature,
    );
  }
  const logs = options.withLogs ? await fetchLogs(connection, signature, commitment) : [];
  return { signature, logs };
}

const REACHED: Record<string, readonly string[]> = {
  processed: ["processed", "confirmed", "finalized"],
  confirmed: ["confirmed", "finalized"],
  finalized: ["finalized"],
};

/**
 * Polls the signature status over HTTP until it reaches `commitment`, and returns the
 * transaction's error (null on success). Throws once the blockhash has expired without the
 * transaction landing. This replaces Connection.confirmTransaction, whose websocket subscription
 * can miss the notification and then wait out the whole blockhash lifetime (60-90s).
 */
async function confirm(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
  commitment: Commitment,
): Promise<unknown> {
  const wanted = REACHED[commitment] ?? REACHED.confirmed;
  for (;;) {
    const [status] = (await connection.getSignatureStatuses([signature])).value;
    if (status?.err) return status.err;
    if (status?.confirmationStatus && wanted.includes(status.confirmationStatus)) return null;
    if ((await connection.getBlockHeight(commitment)) > lastValidBlockHeight) {
      throw new XeroTransactionError(
        `transaction ${signature} expired before it was confirmed`,
        [],
        signature,
      );
    }
    await sleep(250);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchLogs(
  connection: Connection,
  signature: string,
  commitment: Commitment,
): Promise<string[]> {
  const finality = commitment === "finalized" ? "finalized" : "confirmed";
  // A just-confirmed transaction can take a moment to show up in getTransaction.
  for (let attempt = 0; attempt < 10; attempt++) {
    const tx = await connection.getTransaction(signature, {
      commitment: finality,
      maxSupportedTransactionVersion: 0,
    });
    if (tx) return tx.meta?.logMessages ?? [];
    await sleep(200);
  }
  return [];
}
