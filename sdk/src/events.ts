import anchor from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import { IDL } from "./idl/idl.js";

/** `PaymentSettled`, emitted by every successful `pay`. Amounts are in base units. */
export interface PaymentSettledEvent {
  policy: PublicKey;
  spender: PublicKey;
  /** Provider wallet (owner of the recipient token account). */
  recipient: PublicKey;
  amount: bigint;
  /** Total spent in the current window, including this payment. */
  spentInWindow: bigint;
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
    events.push({
      policy: data.policy as PublicKey,
      spender: data.spender as PublicKey,
      recipient: data.recipient as PublicKey,
      amount: BigInt(data.amount.toString()),
      spentInWindow: BigInt((data.spent_in_window ?? data.spentInWindow).toString()),
    });
  }
  return events;
}
