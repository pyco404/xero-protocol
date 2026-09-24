import anchor from "@anchor-lang/core";
import type { Program } from "@anchor-lang/core";
import { getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";
import {
  type Commitment,
  type Connection,
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
} from "@solana/web3.js";
import { type AmountInput, parseAmount } from "./amount.js";
import { InvalidAmountError, XeroError } from "./errors.js";
import { CLUSTERS, type XeroCluster } from "./clusters.js";
import { IDL } from "./idl/idl.js";
import type { XeroPolicy } from "./idl/xero_policy.js";
import { MAX_PROVIDERS, type PolicyState, validateLimits } from "./policy.js";
import { type SendOptions, type Sent, sendInstructions } from "./send.js";
import { Spender } from "./spender.js";
import type { XeroWallet } from "./wallet.js";

/** The program ID the bundled IDL was built for (localnet). */
export const XERO_POLICY_PROGRAM_ID = new PublicKey(IDL.address);

export interface XeroClientConfig {
  connection: Connection;
  /** Signs and pays for every transaction this client sends. */
  wallet: XeroWallet;
  /** Cluster whose deployment to use; sets the default `programId`. Default "localnet". */
  cluster?: XeroCluster;
  /** Overrides the cluster's program ID. */
  programId?: PublicKey;
  /** Commitment for reads and confirmations. Default "confirmed". */
  commitment?: Commitment;
}

export interface CreateSpenderOptions {
  /** Key that will be allowed to call pay(), typically an AI agent's. */
  spender: PublicKey;
  mint: PublicKey;
  /** Initial deposit, taken from `from` (default: the owner's associated token account). */
  deposit?: AmountInput;
  maxPerPayment: AmountInput;
  dailyLimit: AmountInput;
  /** Provider wallets (not token accounts) that may be paid. At most 8. */
  allowedProviders: PublicKey[];
  from?: PublicKey;
}

/** Mint facts every Spender needs. */
export interface MintInfo {
  address: PublicKey;
  decimals: number;
  tokenProgram: PublicKey;
}

/**
 * Entry point of the SDK. The wallet acts as the policy owner for createSpender() and as the
 * signer for everything done through the Spender handles it returns.
 */
export class XeroClient {
  readonly connection: Connection;
  readonly wallet: XeroWallet;
  readonly cluster: XeroCluster;
  readonly programId: PublicKey;
  readonly commitment: Commitment;
  /** @internal Anchor client used to build instructions and decode accounts. */
  readonly program: Program<XeroPolicy>;

  constructor(config: XeroClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.cluster = config.cluster ?? "localnet";
    this.programId = config.programId ?? CLUSTERS[this.cluster].programId;
    this.commitment = config.commitment ?? "confirmed";
    const provider = new anchor.AnchorProvider(this.connection, this.wallet, {
      commitment: this.commitment,
    });
    const idl = { ...IDL, address: this.programId.toBase58() } as unknown as XeroPolicy;
    this.program = new anchor.Program<XeroPolicy>(idl, provider);
  }

  /** The policy PDA for an (owner, spender) pair. */
  policyAddress(owner: PublicKey, spender: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), owner.toBuffer(), spender.toBuffer()],
      this.programId,
    )[0];
  }

  /** The vault PDA (a token account owned by the policy) for a policy. */
  vaultAddress(policy: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), policy.toBuffer()],
      this.programId,
    )[0];
  }

  /**
   * Creates a policy for `spender` owned by this client's wallet, and optionally funds it, in a
   * single transaction. Limits and the allowlist are validated locally first.
   */
  async createSpender(options: CreateSpenderOptions): Promise<Spender> {
    const owner = this.wallet.publicKey;
    const mint = await this.fetchMint(options.mint);
    const maxPerPayment = parseAmount(options.maxPerPayment, mint.decimals);
    const dailyLimit = parseAmount(options.dailyLimit, mint.decimals);
    const deposit =
      options.deposit === undefined ? 0n : parseAmount(options.deposit, mint.decimals);
    if (options.deposit !== undefined && deposit === 0n) {
      throw new InvalidAmountError("deposit must be greater than zero; omit it to skip");
    }
    validateLimits(maxPerPayment, dailyLimit);
    validateAllowlist(options.allowedProviders);

    const policy = this.policyAddress(owner, options.spender);
    const vault = this.vaultAddress(policy);
    const ixs: TransactionInstruction[] = [
      await this.program.methods
        .createPolicy(
          options.spender,
          new anchor.BN(maxPerPayment.toString()),
          new anchor.BN(dailyLimit.toString()),
          options.allowedProviders,
        )
        .accountsStrict({
          owner,
          policy,
          mint: mint.address,
          vault,
          tokenProgram: mint.tokenProgram,
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    ];
    const spender = new Spender(this, this.wallet, owner, options.spender, mint);
    if (deposit > 0n) ixs.push(await spender.depositInstruction(deposit, options.from));
    await this.send(ixs);
    return spender;
  }

  /** Loads an existing policy. Throws XeroError "PolicyNotFound" if there is none. */
  async getSpender(owner: PublicKey, spender: PublicKey): Promise<Spender> {
    const state = await this.fetchPolicy(this.policyAddress(owner, spender));
    if (!state) {
      throw new XeroError(
        "PolicyNotFound",
        `no policy for owner ${owner.toBase58()} and spender ${spender.toBase58()}`,
      );
    }
    return new Spender(this, this.wallet, owner, spender, await this.fetchMint(state.mint));
  }

  /** @internal */
  async fetchMint(address: PublicKey): Promise<MintInfo> {
    const info = await this.connection.getAccountInfo(address, this.commitment);
    if (!info) throw new XeroError("MintNotFound", `mint ${address.toBase58()} does not exist`);
    const mint = await getMint(this.connection, address, this.commitment, info.owner);
    return { address, decimals: mint.decimals, tokenProgram: info.owner };
  }

  /** @internal Fetches and decodes a policy account, or null if it doesn't exist. */
  async fetchPolicy(address: PublicKey): Promise<PolicyState | null> {
    const info = await this.connection.getAccountInfo(address, this.commitment);
    return info ? this.decodePolicy(info.data) : null;
  }

  /** @internal */
  decodePolicy(data: Buffer): PolicyState {
    const raw = this.program.coder.accounts.decode("policy", data);
    return {
      version: raw.version,
      owner: raw.owner,
      spender: raw.spender,
      mint: raw.mint,
      maxPerPayment: BigInt(raw.maxPerPayment.toString()),
      dailyLimit: BigInt(raw.dailyLimit.toString()),
      buckets: raw.buckets.map((b: { toString(): string }) => BigInt(b.toString())),
      lastHour: BigInt(raw.lastHour.toString()),
      allowlist: raw.allowlist.slice(0, raw.allowlistCount),
      paused: raw.paused,
    };
  }

  /** @internal Associated token account of `owner` for `mint`. */
  ata(mint: MintInfo, owner: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(mint.address, owner, true, mint.tokenProgram);
  }

  /** @internal */
  send(ixs: TransactionInstruction[], options?: SendOptions, wallet = this.wallet): Promise<Sent> {
    return sendInstructions(this.connection, wallet, ixs, this.commitment, options);
  }
}

function validateAllowlist(providers: PublicKey[]) {
  if (providers.length > MAX_PROVIDERS) {
    throw new XeroError("AllowlistFull", `at most ${MAX_PROVIDERS} providers are allowed`);
  }
  const seen = new Set(providers.map((p) => p.toBase58()));
  if (seen.size !== providers.length) {
    throw new XeroError("DuplicateProvider", "allowedProviders contains a duplicate");
  }
}
