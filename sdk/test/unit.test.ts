import { Keypair } from "@solana/web3.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import {
  IDL,
  InvalidAmountError,
  PROGRAM_ERRORS,
  PolicyViolation,
  type PolicyState,
  WINDOW_SECONDS,
  XeroProgramError,
  XeroTransactionError,
  errorFromLogs,
  evaluatePayment,
  formatAmount,
  parseAmount,
} from "../src/index.js";
import { remainingToday, windowResetsAt } from "../src/policy.js";

describe("parseAmount", () => {
  it("converts decimal strings using the mint's decimals", () => {
    assert.equal(parseAmount("0.42", 6), 420_000n);
    assert.equal(parseAmount("100", 6), 100_000_000n);
    assert.equal(parseAmount("1.5", 6), 1_500_000n);
    assert.equal(parseAmount("0.000001", 6), 1n);
    assert.equal(parseAmount("0", 6), 0n);
    assert.equal(parseAmount("007.10", 6), 7_100_000n);
    assert.equal(parseAmount("3", 0), 3n);
    assert.equal(parseAmount("0.4200001", 9), 420_000_100n);
  });

  it("rejects more decimal places than the mint allows", () => {
    assert.throws(() => parseAmount("0.4200001", 6), InvalidAmountError);
    assert.throws(() => parseAmount("0.1", 0), InvalidAmountError);
    assert.throws(
      () => parseAmount("1.0000000", 6),
      /7 decimal places; this mint allows at most 6/,
    );
  });

  it("rejects negative, malformed and non-string input", () => {
    for (const bad of [
      "-1",
      "abc",
      "",
      " 1",
      "1 ",
      "1e3",
      "1,000",
      ".5",
      "1.",
      "+1",
      "0x10",
      "NaN",
      "Infinity",
    ]) {
      assert.throws(() => parseAmount(bad, 6), InvalidAmountError, `"${bad}" should be rejected`);
    }
    assert.throws(() => parseAmount(-1n, 6), InvalidAmountError);
    assert.throws(() => parseAmount(0.42 as never, 6), /decimal strings or bigint/);
  });

  it("accepts bigint base units as-is and enforces the u64 range", () => {
    assert.equal(parseAmount(420_000n, 6), 420_000n);
    assert.equal(parseAmount((1n << 64n) - 1n, 6), (1n << 64n) - 1n);
    assert.throws(() => parseAmount(1n << 64n, 6), /does not fit in a u64/);
    assert.throws(() => parseAmount("18446744073709.551616", 6), /does not fit in a u64/);
  });
});

describe("formatAmount", () => {
  it("formats base units without trailing zeros", () => {
    assert.equal(formatAmount(420_000n, 6), "0.42");
    assert.equal(formatAmount(100_000_000n, 6), "100");
    assert.equal(formatAmount(14_580_000n, 6), "14.58");
    assert.equal(formatAmount(1n, 6), "0.000001");
    assert.equal(formatAmount(0n, 6), "0");
    assert.equal(formatAmount(5n, 0), "5");
  });

  it("pads to minFractionDigits for display without ever rounding", () => {
    const usd = { minFractionDigits: 2 };
    assert.equal(formatAmount(4_200_000n, 6, usd), "4.20");
    assert.equal(formatAmount(3_000_000n, 6, usd), "3.00");
    assert.equal(formatAmount(0n, 6, usd), "0.00");
    assert.equal(formatAmount(420_000n, 6, usd), "0.42");
    assert.equal(formatAmount(4_205_000n, 6, usd), "4.205");
    assert.equal(formatAmount(1n, 6, usd), "0.000001");
  });

  it("round-trips with parseAmount", () => {
    for (const s of ["0.42", "1.2", "0.8", "3", "99.58", "0.000001", "18446744073709.551615"]) {
      assert.equal(formatAmount(parseAmount(s, 6), 6), s);
    }
  });
});

describe("evaluatePayment", () => {
  const data = Keypair.generate().publicKey;
  const unknown = Keypair.generate().publicKey;
  const T0 = 1_790_000_000n;
  const fmt = (raw: bigint) => formatAmount(raw, 6);
  const state = (overrides: Partial<PolicyState> = {}): PolicyState => ({
    owner: Keypair.generate().publicKey,
    spender: Keypair.generate().publicKey,
    mint: Keypair.generate().publicKey,
    maxPerPayment: parseAmount("5", 6),
    dailyLimit: parseAmount("20", 6),
    spentInWindow: 0n,
    windowStart: 0n,
    allowlist: [data],
    paused: false,
    ...overrides,
  });
  const code = (s: PolicyState, who: typeof data, amount: string, now = T0, vault?: bigint) => {
    const r = evaluatePayment(s, who, parseAmount(amount, 6), now, fmt, vault);
    return r.allowed ? "allowed" : r.code;
  };

  it("applies the program's order: paused → allowlist → zero → max → daily → balance", () => {
    const spent = { spentInWindow: parseAmount("19", 6), windowStart: T0 };
    assert.equal(code(state({ paused: true, ...spent }), unknown, "40", T0, 0n), "Paused");
    assert.equal(code(state(spent), unknown, "40", T0, 0n), "RecipientNotAllowed");
    assert.equal(code(state(spent), data, "0", T0, 0n), "ZeroAmount");
    assert.equal(code(state(spent), data, "40", T0, 0n), "AmountExceedsMaxPayment");
    assert.equal(code(state(spent), data, "2", T0, 0n), "DailyLimitExceeded");
    assert.equal(code(state(spent), data, "1", T0, 0n), "InsufficientFunds");
    assert.equal(code(state(spent), data, "1", T0), "allowed");
    assert.equal(code(state(spent), data, "1", T0, parseAmount("1", 6)), "allowed");
  });

  it("resets the window exactly WINDOW_SECONDS after its first payment", () => {
    const s = state({ spentInWindow: parseAmount("20", 6), windowStart: T0 });
    assert.equal(code(s, data, "0.01", T0 + WINDOW_SECONDS - 1n), "DailyLimitExceeded");
    assert.equal(code(s, data, "5", T0 + WINDOW_SECONDS), "allowed");
    assert.equal(remainingToday(s, T0 + WINDOW_SECONDS - 1n), 0n);
    assert.equal(remainingToday(s, T0 + WINDOW_SECONDS), parseAmount("20", 6));
    assert.deepEqual(windowResetsAt(s, T0), new Date(Number(T0 + WINDOW_SECONDS) * 1000));
    assert.equal(windowResetsAt(s, T0 + WINDOW_SECONDS), null);
    assert.equal(windowResetsAt(state(), T0), null);
  });

  it("treats a daily limit lowered below what was spent as zero remaining", () => {
    const s = state({
      spentInWindow: parseAmount("5", 6),
      windowStart: T0,
      dailyLimit: parseAmount("4", 6),
      maxPerPayment: parseAmount("4", 6),
    });
    assert.equal(remainingToday(s, T0), 0n);
    assert.equal(code(s, data, "0.01"), "DailyLimitExceeded");
  });
});

describe("bundled IDL", () => {
  it("matches protocol/target (run `npm run sync-idl` after rebuilding the program)", () => {
    const script = new URL("../scripts/sync-idl.mjs", import.meta.url).pathname;
    const result = spawnSync(process.execPath, [script, "--check"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
});

describe("errors", () => {
  it("PROGRAM_ERRORS matches the IDL", () => {
    const fromIdl = Object.fromEntries(IDL.errors.map((e) => [e.code, e.name]));
    assert.deepEqual(fromIdl, PROGRAM_ERRORS);
  });

  it("maps Anchor error logs to PolicyViolation or XeroProgramError", () => {
    const violation = errorFromLogs(
      [
        "Program EK8a invoke [1]",
        "Program log: AnchorError occurred. Error Code: RecipientNotAllowed. Error Number: 6001. Error Message: Recipient is not on the policy allowlist.",
      ],
      "fallback",
    );
    assert.ok(violation instanceof PolicyViolation);
    assert.equal(violation.code, "RecipientNotAllowed");
    assert.equal(violation.source, "chain");
    assert.equal(violation.message, "recipient is not on the policy allowlist");

    const other = errorFromLogs(
      [
        "Program log: AnchorError caused by account: policy. Error Code: Unauthorized. Error Number: 6007. Error Message: Signer is not authorized for this policy.",
      ],
      "fallback",
    );
    assert.ok(other instanceof XeroProgramError);
    assert.equal(other.code, "Unauthorized");
    assert.equal((other as XeroProgramError).errorNumber, 6007);

    const funds = errorFromLogs(["Program log: Error: insufficient funds"], "fallback");
    assert.ok(funds instanceof PolicyViolation);
    assert.equal(funds.code, "InsufficientFunds");

    const unknown = errorFromLogs(["Program log: something else"], "fallback");
    assert.ok(unknown instanceof XeroTransactionError);
    assert.equal(unknown.message, "fallback");
  });
});
