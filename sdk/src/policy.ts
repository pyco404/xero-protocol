import type { PublicKey } from "@solana/web3.js";
import { type PolicyViolationCode, ZeroError } from "./errors.js";

/** Width of one spending bucket in seconds (`BUCKET_SECONDS`, one hour). */
export const BUCKET_SECONDS = 3_600n;
/** Number of hourly buckets the daily limit applies to (`WINDOW_BUCKETS`). */
export const WINDOW_BUCKETS = 24;
/** Largest allowlist the program accepts (`MAX_PROVIDERS`). */
export const MAX_PROVIDERS = 8;

/** On-chain `Policy` account, with amounts as bigint base units and times as unix seconds. */
export interface PolicyState {
  /** Account layout version (1). */
  version: number;
  owner: PublicKey;
  spender: PublicKey;
  mint: PublicKey;
  maxPerPayment: bigint;
  dailyLimit: bigint;
  /**
   * Amount paid per hour, indexed by `hour % 24` where `hour = unixTime / 3600`, as stored on
   * chain. Buckets older than 24 hours before `lastHour` are stale until the next payment clears
   * them; use `spentInWindow()` rather than summing these directly.
   */
  buckets: bigint[];
  /** Hour of the most recent payment (`unixTime / 3600`); 0 before the first payment. */
  lastHour: bigint;
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

const WINDOW = BigInt(WINDOW_BUCKETS);
const floorDiv = (a: bigint, b: bigint) => (a >= 0n ? a / b : -((-a + b - 1n) / b));
const bucketIndex = (hour: bigint) => Number(((hour % WINDOW) + WINDOW) % WINDOW);

/** The hour index (`unixTime / 3600`) a unix time falls in. */
export function hourOf(unixTime: bigint): bigint {
  return floorDiv(unixTime, BUCKET_SECONDS);
}

/**
 * The buckets as the program would see them at `now`: every hour that has left the window since
 * `lastHour` is zeroed. Mirrors `Policy::roll_to` in the program, including leaving the buckets
 * unchanged if the clock is behind `lastHour`.
 */
export function bucketsAt(state: PolicyState, now: bigint): bigint[] {
  const hour = hourOf(now);
  const buckets = [...state.buckets];
  if (hour <= state.lastHour) return buckets;
  if (hour - state.lastHour >= WINDOW) return buckets.map(() => 0n);
  for (let h = state.lastHour + 1n; h <= hour; h++) buckets[bucketIndex(h)] = 0n;
  return buckets;
}

/** Total paid across the last 24 hourly buckets at `now`: what the daily limit is checked against. */
export function spentInWindow(state: PolicyState, now: bigint): bigint {
  return bucketsAt(state, now).reduce((sum, b) => sum + b, 0n);
}

export function remainingToday(state: PolicyState, now: bigint): bigint {
  const left = state.dailyLimit - spentInWindow(state, now);
  return left > 0n ? left : 0n;
}

/**
 * When the oldest amount still counted against the limit leaves the window (the start of the 24th
 * hour after the hour it was paid in), or null if nothing is counted.
 */
export function nextReleaseAt(state: PolicyState, now: bigint): Date | null {
  const buckets = bucketsAt(state, now);
  const newest = hourOf(now) > state.lastHour ? hourOf(now) : state.lastHour;
  for (let hour = newest - WINDOW + 1n; hour <= newest; hour++) {
    if (buckets[bucketIndex(hour)] > 0n) {
      return new Date(Number((hour + WINDOW) * BUCKET_SECONDS) * 1000);
    }
  }
  return null;
}

type Format = (raw: bigint) => string;

/**
 * Mirrors `pay`'s checks in the program's order: paused → allowlist → amount (zero, max per
 * payment) → daily limit over the last 24 hourly buckets. If `vaultBalance` is given, a final balance check stands
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
  const spentAfter = spentInWindow(state, now) + amount;
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
    throw new ZeroError(
      "InvalidLimits",
      "limits must be non-zero and maxPerPayment must not exceed dailyLimit",
    );
  }
}
