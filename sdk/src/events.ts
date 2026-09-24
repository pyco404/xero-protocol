import anchor from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import { IDL } from "./idl/idl.js";

/** `PaymentSettled`, emitted by every successful `pay`. Amounts are in base units. */
export interface PaymentSettledEvent {
  policy: PublicKey;
  spender: PublicKey;
  mint: PublicKey;
  /** Provider wallet (owner of the recipient token account). */
  recipient: PublicKey;
  /** Token account that received the payment. */
  recipientTokenAccount: PublicKey;
  amount: bigint;
  /** Total paid across the last 24 hourly buckets, including this payment. */
  spentInWindow: bigint;
  dailyLimit: bigint;
  /** Cluster unix time of the payment, in seconds. */
  timestamp: bigint;
}

const coder = new anchor.BorshCoder(IDL as never);
const parsers = new Map<string, InstanceType<typeof anchor.EventParser>>();

/**
 * Extracts every `PaymentSettled` event from a transaction's log messages. Only events emitted by
 * `programId` are returned, so a CPI from another program can't forge one.
 */
export function parsePaymentSettled(
  logs: readonly string[],
  programId: PublicKey = new PublicKey(IDL.address),
): PaymentSettledEvent[] {
  const key = programId.toBase58();
  let parser = parsers.get(key);
  if (!parser) {
    parser = new anchor.EventParser(programId, coder);
    parsers.set(key, parser);
  }
  const events: PaymentSettledEvent[] = [];
  for (const event of parser.parseLogs([...logs])) {
    if (event.name !== "PaymentSettled") continue;
    // Anchor 1.2 keeps the IDL's snake_case field names for events.
    const data = event.data as Record<string, { toString(): string } & object>;
    const pick = (snake: string, camel: string) => data[snake] ?? data[camel];
    events.push({
      policy: data.policy as PublicKey,
      spender: data.spender as PublicKey,
      mint: data.mint as PublicKey,
      recipient: data.recipient as PublicKey,
      recipientTokenAccount: pick("recipient_token_account", "recipientTokenAccount") as PublicKey,
      amount: BigInt(data.amount.toString()),
      spentInWindow: BigInt(pick("spent_in_window", "spentInWindow").toString()),
      dailyLimit: BigInt(pick("daily_limit", "dailyLimit").toString()),
      timestamp: BigInt(data.timestamp.toString()),
    });
  }
  return events;
}
