import type { PublicKey } from "@solana/web3.js";
import { type PolicyViolationCode, XeroError } from "./errors.js";

/** Length of the program's rolling spending window (`WINDOW_SECONDS`). */
export const WINDOW_SECONDS = 86_400n;
/** Largest allowlist the program accepts (`MAX_PROVIDERS`). */
export const MAX_PROVIDERS = 8;

/** On-chain `Policy` account, with amounts as bigint base units and times as unix seconds. */
export interface PolicyState {
  owner: PublicKey;
  spender: PublicKey;
  mint: PublicKey;
  maxPerPayment: bigint;
  dailyLimit: bigint;
  spentInWindow: bigint;
  /** Unix time of the first payment in the current window; 0 before the first payment. */
  windowStart: bigint;
  /** Only the valid entries (the program stores a fixed array of 8). */
  allowlist: PublicKey[];
  paused: boolean;
}

export type CheckResult =
  { allowed: true } | { allowed: false; code: PolicyViolationCode; reason: string };

/** Detailed result used internally by check(), pay() and status(). */
export type Evaluation =
  | { allowed: true; spentAfter: bigint }
  | { allowed: false; code: PolicyViolationCode; reason: string };

export function windowExpired(state: PolicyState, now: bigint): boolean {
  return now - state.windowStart >= WINDOW_SECONDS;
}

/** What `spent_in_window` is at `now`, taking an expired window into account. */
export function effectiveSpent(state: PolicyState, now: bigint): bigint {
  return windowExpired(state, now) ? 0n : state.spentInWindow;
}

export function remainingToday(state: PolicyState, now: bigint): bigint {
  const left = state.dailyLimit - effectiveSpent(state, now);
  return left > 0n ? left : 0n;
}

/** When the current window ends, or null if no window is running (none yet, or it expired). */
export function windowResetsAt(state: PolicyState, now: bigint): Date | null {
  if (state.windowStart === 0n || windowExpired(state, now)) return null;
  return new Date(Number(state.windowStart + WINDOW_SECONDS) * 1000);
}

type Format = (raw: bigint) => string;

/**
 * Mirrors `pay`'s checks in the program's order: paused → allowlist → amount (zero, max per
 * payment) → window reset → daily limit. If `vaultBalance` is given, a final balance check stands
 * in for the token program's own "insufficient funds" failure.
 *
 * The program remains the source of truth; this exists for fast feedback and UI.
 */
export function evaluatePayment(
  state: PolicyState,
  recipient: PublicKey,
  amount: bigint,
  now: bigint,
  format: Format,
  vaultBalance?: bigint,
): Evaluation {
  const deny = (code: PolicyViolationCode, reason: string): Evaluation => ({
    allowed: false,
    code,
    reason,
  });

  if (state.paused) return deny("Paused", "policy is paused");
  if (!state.allowlist.some((p) => p.equals(recipient))) {
    return deny("RecipientNotAllowed", `recipient ${recipient.toBase58()} is not on the allowlist`);
  }
  if (amount === 0n) return deny("ZeroAmount", "amount must be greater than zero");
  if (amount > state.maxPerPayment) {
    return deny(
      "AmountExceedsMaxPayment",
      `amount ${format(amount)} exceeds max payment ${format(state.maxPerPayment)}`,
    );
  }
  const spentAfter = effectiveSpent(state, now) + amount;
  if (spentAfter > state.dailyLimit) {
    return deny(
      "DailyLimitExceeded",
      `amount ${format(amount)} exceeds the ${format(remainingToday(state, now))} left of the ` +
        `${format(state.dailyLimit)} daily limit`,
    );
  }
  if (vaultBalance !== undefined && amount > vaultBalance) {
    return deny(
      "InsufficientFunds",
      `amount ${format(amount)} exceeds the vault balance of ${format(vaultBalance)}`,
    );
  }
  return { allowed: true, spentAfter };
}

/** Same rule as the program's `InvalidLimits`. */
export function validateLimits(maxPerPayment: bigint, dailyLimit: bigint) {
  if (maxPerPayment === 0n || dailyLimit === 0n || maxPerPayment > dailyLimit) {
    throw new XeroError(
      "InvalidLimits",
      "limits must be non-zero and maxPerPayment must not exceed dailyLimit",
    );
  }
}
