import {
  AnchorProvider,
  BN,
  BorshCoder,
  EventParser,
  Program,
  web3,
} from "@anchor-lang/core";
import {
  ACCOUNT_SIZE,
  AccountLayout,
  ExtensionType,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createInitializeAccount3Instruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAccountLenForMint,
  getMintLen,
  unpackMint,
} from "@solana/spl-token";
import { getTransactionDecoder } from "@solana/kit";
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from "litesvm";
import { expect } from "chai";
import { readFileSync } from "fs";
import type { ZeroPolicy } from "../target/types/zero_policy";

const { Keypair, PublicKey, SystemProgram, Transaction } = web3;
type Keypair = web3.Keypair;
type PublicKey = web3.PublicKey;

export const DECIMALS = 6;
/** Converts a dollar amount to base units of a 6-decimal, USDC-like mint. */
export const usd = (dollars: number) =>
  new BN(Math.round(dollars * 10 ** DECIMALS));
export const DAY = 24 * 60 * 60;
/** Arbitrary but realistic start time; LiteSVM's clock starts at 0. */
export const START_TIME = 1_790_000_000;

const PROGRAM_SO = `${__dirname}/../target/deploy/zero_policy.so`;
const idl: ZeroPolicy = JSON.parse(
  readFileSync(`${__dirname}/../target/idl/zero_policy.json`, "utf8")
);

// Instructions are built offline with Anchor's coder, so the provider never talks to a cluster.
const offlineProvider = {
  connection: new web3.Connection("http://127.0.0.1:8899"),
  publicKey: Keypair.generate().publicKey,
} as unknown as AnchorProvider;

export const program = new Program<ZeroPolicy>(idl, offlineProvider);
const events = new EventParser(program.programId, new BorshCoder(idl));

export type TxResult = TransactionMetadata | FailedTransactionMetadata;

/**
 * Test harness around LiteSVM. Transactions are built and signed with web3.js v1 (what the
 * Anchor client produces), then decoded into the @solana/kit format LiteSVM 1.x expects.
 */
export class Harness {
  readonly svm = new LiteSVM();

  constructor() {
    this.svm.addProgramFromFile(
      program.programId.toBase58() as never,
      PROGRAM_SO
    );
    this.setTime(START_TIME);
  }

  keypair(): Keypair {
    const kp = Keypair.generate();
    this.svm.airdrop(
      kp.publicKey.toBase58() as never,
      BigInt(10 * web3.LAMPORTS_PER_SOL) as never
    );
    return kp;
  }

  now(): number {
    return Number(this.svm.getClock().unixTimestamp);
  }

  setTime(unixTimestamp: number) {
    const clock = this.svm.getClock();
    clock.unixTimestamp = BigInt(unixTimestamp);
    this.svm.setClock(clock);
  }

  advance(seconds: number) {
    this.setTime(this.now() + seconds);
  }

  send(ixs: web3.TransactionInstruction[], signers: Keypair[]): TxResult {
    const tx = new Transaction();
    tx.recentBlockhash = this.svm.latestBlockhash();
    tx.feePayer = signers[0].publicKey;
    tx.add(...ixs);
    tx.sign(...signers);
    const result = this.svm.sendTransaction(
      getTransactionDecoder().decode(tx.serialize())
    );
    // New blockhash per transaction, so identical payments don't collide as duplicates.
    this.svm.expireBlockhash();
    return result;
  }

  async sendIx(
    ix: Promise<web3.TransactionInstruction>,
    signers: Keypair[]
  ): Promise<TxResult> {
    return this.send([await ix], signers);
  }

  createMint(authority: Keypair, tokenProgram = TOKEN_PROGRAM_ID): PublicKey {
    const mint = Keypair.generate();
    const rent = Number(
      this.svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE))
    );
    expectOk(
      this.send(
        [
          SystemProgram.createAccount({
            fromPubkey: authority.publicKey,
            newAccountPubkey: mint.publicKey,
            lamports: rent,
            space: MINT_SIZE,
            programId: tokenProgram,
          }),
          createInitializeMint2Instruction(
            mint.publicKey,
            DECIMALS,
            authority.publicKey,
            null,
            tokenProgram
          ),
        ],
        [authority, mint]
      )
    );
    return mint.publicKey;
  }

  /**
   * Token-2022 mint with extensions. `initExtensions` returns the instructions that initialize
   * each extension; they must run before InitializeMint2.
   */
  createMintWithExtensions(
    authority: Keypair,
    extensions: ExtensionType[],
    initExtensions: (mint: PublicKey) => web3.TransactionInstruction[]
  ): PublicKey {
    const mint = Keypair.generate();
    const space = getMintLen(extensions);
    const rent = Number(this.svm.minimumBalanceForRentExemption(BigInt(space)));
    expectOk(
      this.send(
        [
          SystemProgram.createAccount({
            fromPubkey: authority.publicKey,
            newAccountPubkey: mint.publicKey,
            lamports: rent,
            space,
            programId: TOKEN_2022_PROGRAM_ID,
          }),
          ...initExtensions(mint.publicKey),
          createInitializeMint2Instruction(
            mint.publicKey,
            DECIMALS,
            authority.publicKey,
            null,
            TOKEN_2022_PROGRAM_ID
          ),
        ],
        [authority, mint]
      )
    );
    return mint.publicKey;
  }

  lamports(account: PublicKey): bigint {
    return BigInt(this.svm.getBalance(account.toBase58() as never) ?? 0);
  }

  exists(account: PublicKey): boolean {
    return this.svm.getAccount(account.toBase58() as never).exists;
  }

  createTokenAccount(
    payer: Keypair,
    mint: PublicKey,
    owner: PublicKey,
    tokenProgram = TOKEN_PROGRAM_ID
  ): PublicKey {
    const account = Keypair.generate();
    const space = this.tokenAccountSize(mint, tokenProgram);
    const rent = Number(this.svm.minimumBalanceForRentExemption(BigInt(space)));
    expectOk(
      this.send(
        [
          SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: account.publicKey,
            lamports: rent,
            space,
            programId: tokenProgram,
          }),
          createInitializeAccount3Instruction(
            account.publicKey,
            mint,
            owner,
            tokenProgram
          ),
        ],
        [payer, account]
      )
    );
    return account.publicKey;
  }

  /** Token-2022 mints with some extensions need token accounts larger than ACCOUNT_SIZE. */
  private tokenAccountSize(mint: PublicKey, tokenProgram: PublicKey): number {
    if (!tokenProgram.equals(TOKEN_2022_PROGRAM_ID)) return ACCOUNT_SIZE;
    const info = this.svm.getAccount(mint.toBase58() as never);
    if (!info.exists) throw new Error(`mint ${mint.toBase58()} does not exist`);
    const decoded = unpackMint(
      mint,
      { ...info, data: Buffer.from(info.data), owner: tokenProgram } as never,
      tokenProgram
    );
    return getAccountLenForMint(decoded);
  }

  mintTo(
    authority: Keypair,
    mint: PublicKey,
    destination: PublicKey,
    amount: BN,
    tokenProgram = TOKEN_PROGRAM_ID
  ) {
    expectOk(
      this.send(
        [
          createMintToInstruction(
            mint,
            destination,
            authority.publicKey,
            BigInt(amount.toString()),
            [],
            tokenProgram
          ),
        ],
        [authority]
      )
    );
  }

  tokenBalance(account: PublicKey): BN {
    const info = this.svm.getAccount(account.toBase58() as never);
    if (!info.exists)
      throw new Error(`token account ${account.toBase58()} does not exist`);
    // Token-2022 accounts may carry extensions after the base layout; only the base is read.
    const data = Buffer.from(info.data).subarray(0, ACCOUNT_SIZE);
    return new BN(AccountLayout.decode(data).amount.toString());
  }

  fetchPolicy(policy: PublicKey) {
    const info = this.svm.getAccount(policy.toBase58() as never);
    if (!info.exists)
      throw new Error(`policy ${policy.toBase58()} does not exist`);
    return program.coder.accounts.decode("policy", Buffer.from(info.data));
  }
}

export function policyPda(owner: PublicKey, spender: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), owner.toBuffer(), spender.toBuffer()],
    program.programId
  )[0];
}

export function vaultPda(policy: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), policy.toBuffer()],
    program.programId
  )[0];
}

function describeFailure(result: FailedTransactionMetadata): string {
  return `${result.toString()}\n${result.meta().logs().join("\n")}`;
}

export function expectOk(result: TxResult): TransactionMetadata {
  if (result instanceof FailedTransactionMetadata) {
    expect.fail(`transaction failed:\n${describeFailure(result)}`);
  }
  return result as TransactionMetadata;
}

/** Asserts the transaction failed with the given Anchor error name (e.g. "Paused"). */
export function expectError(result: TxResult, errorName: string) {
  if (!(result instanceof FailedTransactionMetadata)) {
    expect.fail(`expected ${errorName}, but the transaction succeeded`);
  }
  const logs = result.meta().logs().join("\n");
  expect(logs, `expected ${errorName}; logs:\n${logs}`).to.include(
    `Error Code: ${errorName}.`
  );
}

export function parseEvents(result: TransactionMetadata) {
  return [...events.parseLogs(result.logs())];
}

export { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID };
