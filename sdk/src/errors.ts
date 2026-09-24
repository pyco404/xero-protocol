/** xero_policy program errors, by Anchor error number. Kept in sync with the IDL by a unit test. */
export const PROGRAM_ERRORS = {
  6000: "Paused",
  6001: "RecipientNotAllowed",
  6002: "AmountExceedsMaxPayment",
  6003: "DailyLimitExceeded",
  6004: "ZeroAmount",
  6005: "AllowlistFull",
  6006: "DuplicateProvider",
  6007: "Unauthorized",
  6008: "MathOverflow",
  6009: "ProviderNotFound",
  6010: "InvalidLimits",
  6011: "UnsupportedMint",
} as const;

export type ProgramErrorName = (typeof PROGRAM_ERRORS)[keyof typeof PROGRAM_ERRORS];

/**
 * Reasons a payment is refused. All but `InsufficientFunds` are xero_policy errors;
 * `InsufficientFunds` is the token program refusing a transfer larger than the vault balance.
 */
export type PolicyViolationCode =
  | "Paused"
  | "RecipientNotAllowed"
  | "ZeroAmount"
  | "AmountExceedsMaxPayment"
  | "DailyLimitExceeded"
  | "InsufficientFunds";

const VIOLATION_CODES: ReadonlySet<string> = new Set<PolicyViolationCode>([
  "Paused",
  "RecipientNotAllowed",
  "ZeroAmount",
  "AmountExceedsMaxPayment",
  "DailyLimitExceeded",
  "InsufficientFunds",
]);

const DEFAULT_MESSAGES: Record<PolicyViolationCode, string> = {
  Paused: "policy is paused",
  RecipientNotAllowed: "recipient is not on the policy allowlist",
  ZeroAmount: "amount must be greater than zero",
  AmountExceedsMaxPayment: "amount exceeds the policy's max payment",
  DailyLimitExceeded: "payment would exceed the policy's daily limit",
  InsufficientFunds: "vault balance is too low for this payment",
};

/** Base class for every error the SDK throws on purpose. */
export class XeroError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * A payment the policy does not allow. Thrown by `pay()` either before anything is sent (the
 * local check failed, `source: "check"`) or after the chain rejected it (`source: "chain"`).
 */
export class PolicyViolation extends XeroError {
  declare readonly code: PolicyViolationCode;

  constructor(
    code: PolicyViolationCode,
    message: string = DEFAULT_MESSAGES[code],
    readonly source: "check" | "chain" = "check",
    readonly logs: readonly string[] = [],
  ) {
    super(code, message);
  }
}

/** An amount that can't be converted to base units (bad format, too many decimals, negative). */
export class InvalidAmountError extends XeroError {
  constructor(message: string) {
    super("InvalidAmount", message);
  }
}

/** A xero_policy or Anchor error other than a policy violation (e.g. Unauthorized, InvalidLimits). */
export class XeroProgramError extends XeroError {
  constructor(
    code: string,
    readonly errorNumber: number | undefined,
    message: string,
    readonly logs: readonly string[],
  ) {
    super(code, message);
  }
}

/** A transaction that failed for a reason the SDK can't attribute to the program. */
export class XeroTransactionError extends XeroError {
  constructor(
    message: string,
    readonly logs: readonly string[],
    readonly signature?: string,
  ) {
    super("TransactionFailed", message);
  }
}

export function isPolicyViolationCode(code: string): code is PolicyViolationCode {
  return VIOLATION_CODES.has(code);
}

const ANCHOR_ERROR = /Error Code: (\w+)\. Error Number: (\d+)\. Error Message: (.*?)\.?$/;
const TOKEN_INSUFFICIENT_FUNDS = /Program log: Error: insufficient funds/;

/**
 * Turns a failed transaction's logs into the matching SDK error: a PolicyViolation for payment
 * rejections, XeroProgramError for other Anchor errors, XeroTransactionError otherwise.
 */
export function errorFromLogs(
  logs: readonly string[],
  fallback: string,
  signature?: string,
): XeroError {
  for (const line of logs) {
    const match = ANCHOR_ERROR.exec(line);
    if (!match) continue;
    const [, code, number, message] = match;
    if (isPolicyViolationCode(code)) {
      return new PolicyViolation(
        code,
        message.charAt(0).toLowerCase() + message.slice(1),
        "chain",
        logs,
      );
    }
    return new XeroProgramError(code, Number(number), message, logs);
  }
  if (logs.some((line) => TOKEN_INSUFFICIENT_FUNDS.test(line))) {
    return new PolicyViolation("InsufficientFunds", undefined, "chain", logs);
  }
  return new XeroTransactionError(fallback, logs, signature);
}
