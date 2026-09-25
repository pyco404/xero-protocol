import anchor from "@anchor-lang/core";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import {
  type AccountInfo,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  type AmountInput,
  type TokenAmount,
  formatAmount,
  parseAmount,
  tokenAmount,
} from "./amount.js";
import type { MintInfo, ZeroClient } from "./client.js";
import { PolicyViolation, ZeroError, ZeroTransactionError } from "./errors.js";
import { type PaymentSettledEvent, parsePaymentSettled } from "./events.js";
import {
  type CheckResult,
  type Evaluation,
  type PolicyState,
  evaluatePayment,
  remainingToday,
  validateLimits,
  nextReleaseAt,
  spentInWindow,
} from "./policy.js";
import type { ZeroWallet } from "./wallet.js";

export interface PaymentRequest {
  /** Provider wallet to pay. Its associated token account for the mint receives the tokens. */
  recipient: PublicKey;
  amount: AmountInput;
  /** Pay into this token account instead of the recipient's associated token account. */
  recipientTokenAccount?: PublicKey;
}

export interface PayOptions {
  /** Send without running check() first. The program still enforces the policy. */
  skipCheck?: boolean;
  /** Skip the RPC node's simulation, so a rejected payment lands on chain as a failed transaction. */
  skipPreflight?: boolean;
}

export interface PaymentResult {
  status: "settled";
  signature: string;
  amount: TokenAmount;
  /** Paid across the last 24 hourly buckets, including this payment. */
  spentInWindow: TokenAmount;
  /** What the daily limit still allows in this window. Does not account for the vault balance. */
  remainingToday: TokenAmount;
  event: PaymentSettledEvent;
}

export interface SpenderStatus {
  policy: PublicKey;
  owner: PublicKey;
  spender: PublicKey;
  mint: PublicKey;
  /** Vault balance. */
  balance: TokenAmount;
  limits: { maxPerPayment: TokenAmount; dailyLimit: TokenAmount };
  allowlist: PublicKey[];
  paused: boolean;
  /** Paid across the last 24 hourly buckets (what the daily limit is checked against). */
  spentInWindow: TokenAmount;
  /** What the daily limit still allows right now. Does not account for the vault balance. */
  remainingToday: TokenAmount;
  /**
   * When the oldest counted payment leaves the window and frees budget (the start of the 24th
   * hour after it was paid); null if nothing is counted.
   */
  nextReleaseAt: Date | null;
}

interface Snapshot {
  state: PolicyState;
  vaultBalance: bigint;
  /** Unix time from the cluster's Clock sysvar, which is what the program compares against. */
  now: bigint;
  recipientAccount: TokenAccountFields | null;
}

interface TokenAccountFields {
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
}

/**
 * A handle on one policy (one owner + spender pair). Owner actions must be sent from a client whose
 * wallet is the owner, and pay() from one whose wallet is the spender; use `as()` to switch.
 */
export class Spender {
  readonly policy: PublicKey;
  readonly vault: PublicKey;

  /** @internal Use ZeroClient.createSpender or ZeroClient.getSpender. */
  constructor(
    private readonly client: ZeroClient,
    private readonly wallet: ZeroWallet,
    readonly owner: PublicKey,
    readonly spender: PublicKey,
    readonly mint: MintInfo,
  ) {
    this.policy = client.policyAddress(owner, spender);
    this.vault = client.vaultAddress(this.policy);
  }

  /** The same policy, with transactions signed and paid for by `wallet`. */
  as(wallet: ZeroWallet): Spender {
    return new Spender(this.client, wallet, this.owner, this.spender, this.mint);
  }

  // ---------------------------------------------------------------- reads

  async status(): Promise<SpenderStatus> {
    const { state, vaultBalance, now } = await this.snapshot();
    const amount = (raw: bigint) => tokenAmount(raw, this.mint.decimals);
    return {
      policy: this.policy,
      owner: this.owner,
      spender: this.spender,
      mint: this.mint.address,
      balance: amount(vaultBalance),
      limits: {
        maxPerPayment: amount(state.maxPerPayment),
        dailyLimit: amount(state.dailyLimit),
      },
      allowlist: state.allowlist,
      paused: state.paused,
      spentInWindow: amount(spentInWindow(state, now)),
      remainingToday: amount(remainingToday(state, now)),
      nextReleaseAt: nextReleaseAt(state, now),
    };
  }

  /**
   * Local pre-flight check of a payment against the current on-chain state, in the program's
   * order (paused → allowlist → amount → daily limit over the last 24 hourly buckets), then the vault balance. Reads
   * accounts but never sends a transaction. Throws InvalidAmountError for a malformed amount.
   */
  async check(request: PaymentRequest): Promise<CheckResult> {
    const amount = parseAmount(request.amount, this.mint.decimals);
    const recipientAccount = this.recipientTokenAccount(request);
    const snapshot = await this.snapshot(recipientAccount);
    const result = this.evaluate(snapshot, recipientAccount, amount);
    return result.allowed
      ? { allowed: true }
      : { allowed: false, code: result.code, reason: result.reason };
  }

  // ---------------------------------------------------------------- spender

  /**
   * Pays `amount` from the vault to an allowlisted provider. Runs check() first and throws
   * PolicyViolation without sending anything if it fails; a rejection by the chain is thrown as
   * the same PolicyViolation type (`source: "chain"`).
   */
  async pay(request: PaymentRequest, options: PayOptions = {}): Promise<PaymentResult> {
    const amount = parseAmount(request.amount, this.mint.decimals);
    if (!this.wallet.publicKey.equals(this.spender)) {
      throw new ZeroError(
        "Unauthorized",
        `pay() must be signed by the spender ${this.spender.toBase58()}; use spender.as(wallet)`,
      );
    }
    const recipientAccount = this.recipientTokenAccount(request);
    const snapshot = await this.snapshot(recipientAccount);
    if (!options.skipCheck) {
      const result = this.evaluate(snapshot, recipientAccount, amount);
      if (!result.allowed) throw new PolicyViolation(result.code, result.reason, "check");
    }

    const ix = await this.client.program.methods
      .pay(new anchor.BN(amount.toString()))
      .accountsStrict({
        spender: this.spender,
        policy: this.policy,
        mint: this.mint.address,
        vault: this.vault,
        recipient: recipientAccount,
        tokenProgram: this.mint.tokenProgram,
      })
      .instruction();
    const { signature, logs } = await this.send([ix], {
      skipPreflight: options.skipPreflight,
      withLogs: true,
    });

    const event = parsePaymentSettled(logs, this.client.programId).find((e) =>
      e.policy.equals(this.policy),
    );
    if (!event) {
      throw new ZeroTransactionError(
        `payment ${signature} confirmed but no PaymentSettled event was found in its logs`,
        logs,
        signature,
      );
    }
    const left = snapshot.state.dailyLimit - event.spentInWindow;
    return {
      status: "settled",
      signature,
      amount: tokenAmount(event.amount, this.mint.decimals),
      spentInWindow: tokenAmount(event.spentInWindow, this.mint.decimals),
      remainingToday: tokenAmount(left > 0n ? left : 0n, this.mint.decimals),
      event,
    };
  }

  // ---------------------------------------------------------------- owner

  /** Moves tokens from the owner (default: their associated token account) into the vault. */
  async deposit({ amount, from }: { amount: AmountInput; from?: PublicKey }): Promise<string> {
    const raw = parseAmount(amount, this.mint.decimals);
    return this.sendAsOwner([await this.depositInstruction(raw, from)]);
  }

  /**
   * Moves tokens out of the vault. Works while paused. Without `destination`, pays into the
   * owner's associated token account, creating it if needed.
   */
  async withdraw({
    amount,
    destination,
  }: {
    amount: AmountInput;
    destination?: PublicKey;
  }): Promise<string> {
    const raw = parseAmount(amount, this.mint.decimals);
    const [target, setup] = this.ownerDestination(destination);
    const ix = await this.client.program.methods
      .withdraw(new anchor.BN(raw.toString()))
      .accountsStrict({
        owner: this.owner,
        policy: this.policy,
        mint: this.mint.address,
        vault: this.vault,
        destination: target,
        tokenProgram: this.mint.tokenProgram,
      })
      .instruction();
    return this.sendAsOwner([...setup, ix]);
  }

  /** Blocks pay() until resume(). Withdrawals and close() still work. */
  pause(): Promise<string> {
    return this.setPaused(true);
  }

  resume(): Promise<string> {
    return this.setPaused(false);
  }

  async updateLimits({
    maxPerPayment,
    dailyLimit,
  }: {
    maxPerPayment: AmountInput;
    dailyLimit: AmountInput;
  }): Promise<string> {
    const max = parseAmount(maxPerPayment, this.mint.decimals);
    const daily = parseAmount(dailyLimit, this.mint.decimals);
    validateLimits(max, daily);
    const ix = await this.client.program.methods
      .updateLimits(new anchor.BN(max.toString()), new anchor.BN(daily.toString()))
      .accountsStrict({ owner: this.owner, policy: this.policy })
      .instruction();
    return this.sendAsOwner([ix]);
  }

  async addProvider(provider: PublicKey): Promise<string> {
    const ix = await this.client.program.methods
      .addProvider(provider)
      .accountsStrict({ owner: this.owner, policy: this.policy })
      .instruction();
    return this.sendAsOwner([ix]);
  }

  async removeProvider(provider: PublicKey): Promise<string> {
    const ix = await this.client.program.methods
      .removeProvider(provider)
      .accountsStrict({ owner: this.owner, policy: this.policy })
      .instruction();
    return this.sendAsOwner([ix]);
  }

  /**
   * Sweeps the vault to `destination` (default: the owner's associated token account, created if
   * needed), then closes the vault and the policy and refunds their rent to the owner.
   */
  async close({ destination }: { destination?: PublicKey } = {}): Promise<string> {
    const [target, setup] = this.ownerDestination(destination);
    const ix = await this.client.program.methods
      .closePolicy()
      .accountsStrict({
        owner: this.owner,
        policy: this.policy,
        mint: this.mint.address,
        vault: this.vault,
        destination: target,
        tokenProgram: this.mint.tokenProgram,
      })
      .instruction();
    return this.sendAsOwner([...setup, ix]);
  }

  // ---------------------------------------------------------------- internals

  /** @internal */
  async depositInstruction(amount: bigint, from?: PublicKey): Promise<TransactionInstruction> {
    return this.client.program.methods
      .deposit(new anchor.BN(amount.toString()))
      .accountsStrict({
        owner: this.owner,
        policy: this.policy,
        mint: this.mint.address,
        ownerTokenAccount: from ?? this.client.ata(this.mint, this.owner),
        vault: this.vault,
        tokenProgram: this.mint.tokenProgram,
      })
      .instruction();
  }

  private setPaused(paused: boolean): Promise<string> {
    return this.client.program.methods
      .setPaused(paused)
      .accountsStrict({ owner: this.owner, policy: this.policy })
      .instruction()
      .then((ix) => this.sendAsOwner([ix]));
  }

  private ownerDestination(destination?: PublicKey): [PublicKey, TransactionInstruction[]] {
    if (destination) return [destination, []];
    const ata = this.client.ata(this.mint, this.owner);
    return [
      ata,
      [
        createAssociatedTokenAccountIdempotentInstruction(
          this.wallet.publicKey,
          ata,
          this.owner,
          this.mint.address,
          this.mint.tokenProgram,
        ),
      ],
    ];
  }

  private recipientTokenAccount(request: PaymentRequest): PublicKey {
    return request.recipientTokenAccount ?? this.client.ata(this.mint, request.recipient);
  }

  private evaluate(snapshot: Snapshot, recipientAccount: PublicKey, amount: bigint): Evaluation {
    const account = snapshot.recipientAccount;
    if (!account) {
      throw new ZeroError(
        "RecipientAccountMissing",
        `recipient token account ${recipientAccount.toBase58()} does not exist; the provider ` +
          `must have a token account for mint ${this.mint.address.toBase58()}`,
      );
    }
    if (!account.mint.equals(this.mint.address)) {
      throw new ZeroError(
        "RecipientMintMismatch",
        `token account ${recipientAccount.toBase58()} holds a different mint`,
      );
    }
    // Like the program, judge the payment by who owns the token account being paid.
    return evaluatePayment(
      snapshot.state,
      account.owner,
      amount,
      snapshot.now,
      (raw) => formatAmount(raw, this.mint.decimals),
      snapshot.vaultBalance,
    );
  }

  /** Policy, vault, clock and (optionally) recipient in one RPC call, so they are consistent. */
  private async snapshot(recipientAccount?: PublicKey): Promise<Snapshot> {
    const keys = [this.policy, this.vault, SYSVAR_CLOCK_PUBKEY];
    if (recipientAccount) keys.push(recipientAccount);
    const [policy, vault, clock, recipient] = await this.client.connection.getMultipleAccountsInfo(
      keys,
      this.client.commitment,
    );
    if (!policy || !vault) {
      throw new ZeroError("PolicyNotFound", `policy ${this.policy.toBase58()} does not exist`);
    }
    if (!clock) throw new ZeroError("ClockUnavailable", "could not read the Clock sysvar");
    return {
      state: this.client.decodePolicy(policy.data),
      vaultBalance: readTokenAccount(vault).amount,
      // Clock layout: slot, epoch_start_timestamp, epoch, leader_schedule_epoch, unix_timestamp.
      now: clock.data.readBigInt64LE(32),
      recipientAccount: recipient ? readTokenAccount(recipient) : null,
    };
  }

  private async sendAsOwner(ixs: TransactionInstruction[]): Promise<string> {
    if (!this.wallet.publicKey.equals(this.owner)) {
      throw new ZeroError(
        "Unauthorized",
        `this action must be signed by the owner ${this.owner.toBase58()}; use spender.as(wallet)`,
      );
    }
    return (await this.send(ixs)).signature;
  }

  private send(ixs: TransactionInstruction[], options?: Parameters<ZeroClient["send"]>[1]) {
    return this.client.send(ixs, options, this.wallet);
  }
}

/** Base layout shared by SPL Token and Token-2022 accounts: mint, owner, amount. */
function readTokenAccount(info: AccountInfo<Buffer>): TokenAccountFields {
  return {
    mint: new PublicKey(info.data.subarray(0, 32)),
    owner: new PublicKey(info.data.subarray(32, 64)),
    amount: info.data.readBigUInt64LE(64),
  };
}
