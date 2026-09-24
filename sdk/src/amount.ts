import { InvalidAmountError } from "./errors.js";

/**
 * An amount of the policy's token. A string is in human units ("0.42" = 42 cents of a
 * 6-decimal token); a bigint is in base units (420_000n). Numbers are not accepted: floating
 * point cannot represent most decimal amounts exactly.
 */
export type AmountInput = string | bigint;

/** An amount as both base units and a decimal string, e.g. `{ raw: 420000n, decimal: "0.42" }`. */
export interface TokenAmount {
  raw: bigint;
  decimal: string;
}

export const U64_MAX = (1n << 64n) - 1n;
const DECIMAL = /^(\d+)(?:\.(\d+))?$/;

/**
 * Converts an amount to base units. Rejects negative values, anything that isn't a plain decimal
 * ("1e3", "abc", " 1", "1,000"), more fractional digits than the mint has, and values above u64.
 */
export function parseAmount(input: AmountInput, decimals: number): bigint {
  let raw: bigint;
  if (typeof input === "bigint") {
    raw = input;
  } else if (typeof input === "string") {
    const match = DECIMAL.exec(input);
    if (!match) {
      throw new InvalidAmountError(`"${input}" is not a non-negative decimal amount`);
    }
    const [, whole, fraction = ""] = match;
    if (fraction.length > decimals) {
      throw new InvalidAmountError(
        `"${input}" has ${fraction.length} decimal places; this mint allows at most ${decimals}`,
      );
    }
    raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  } else {
    throw new InvalidAmountError(
      `amounts must be decimal strings or bigint base units, got ${typeof input}`,
    );
  }
  if (raw < 0n) throw new InvalidAmountError(`amount must not be negative, got ${raw}`);
  if (raw > U64_MAX) throw new InvalidAmountError(`amount ${input} does not fit in a u64`);
  return raw;
}

export interface FormatOptions {
  /**
   * Pad the fraction with zeros to at least this many digits, e.g. 2 for dollars:
   * 4_200_000n → "4.20". Digits beyond it are kept, never rounded: 4_205_000n → "4.205".
   */
  minFractionDigits?: number;
}

/**
 * Formats base units as an exact decimal string. By default trailing zeros are dropped
 * (420000n → "0.42", 3_000_000n → "3"); `minFractionDigits` pads for display.
 */
export function formatAmount(raw: bigint, decimals: number, options: FormatOptions = {}): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const minDigits = options.minFractionDigits ?? 0;
  const fraction = (abs % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "")
    .padEnd(minDigits, "0");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function tokenAmount(raw: bigint, decimals: number): TokenAmount {
  return { raw, decimal: formatAmount(raw, decimals) };
}
