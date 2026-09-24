import { BN, web3 } from "@anchor-lang/core";
import {
  ExtensionType,
  createInitializeMintCloseAuthorityInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeTransferFeeConfigInstruction,
} from "@solana/spl-token";
import { expect } from "chai";
import {
  DAY,
  Harness,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  expectError,
  expectOk,
  parseEvents,
  policyPda,
  program,
  usd,
  vaultPda,
} from "./helpers";

type Keypair = web3.Keypair;
type PublicKey = web3.PublicKey;

// Same numbers as the website: $100 budget, $20 daily limit, $5 max payment.
const BUDGET = usd(100);
const DAILY_LIMIT = usd(20);
const MAX_PAYMENT = usd(5);

/**
 * Fresh chain per test: an owner with $1,000 of a 6-decimal test mint, a spender policy funded
 * with $100, and two allowlisted providers standing in for data.api and compute.api.
 */
function setup(
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  makeMint?: (h: Harness, authority: Keypair) => PublicKey
) {
  const h = new Harness();
  const owner = h.keypair();
  const spender = h.keypair();
  const stranger = h.keypair();
  const dataApi = web3.Keypair.generate();
  const computeApi = web3.Keypair.generate();
  const unknownApi = web3.Keypair.generate();

  const mint = makeMint
    ? makeMint(h, owner)
    : h.createMint(owner, tokenProgram);
  const ownerTokens = h.createTokenAccount(
    owner,
    mint,
    owner.publicKey,
    tokenProgram
  );
  h.mintTo(owner, mint, ownerTokens, usd(1000), tokenProgram);

  const tokenAccountFor = (who: Keypair) =>
    h.createTokenAccount(owner, mint, who.publicKey, tokenProgram);
  const dataApiTokens = tokenAccountFor(dataApi);
  const computeApiTokens = tokenAccountFor(computeApi);
  const unknownApiTokens = tokenAccountFor(unknownApi);

  const policy = policyPda(owner.publicKey, spender.publicKey);
  const vault = vaultPda(policy);

  const ix = {
    createPolicy: (
      allowlist: PublicKey[],
      signer = owner,
      maxPerPayment = MAX_PAYMENT,
      dailyLimit = DAILY_LIMIT
    ) =>
      program.methods
        .createPolicy(spender.publicKey, maxPerPayment, dailyLimit, allowlist)
        .accountsStrict({
          owner: signer.publicKey,
          policy: policyPda(signer.publicKey, spender.publicKey),
          mint,
          vault: vaultPda(policyPda(signer.publicKey, spender.publicKey)),
          tokenProgram,
          systemProgram: web3.SystemProgram.programId,
        })
        .instruction(),
    deposit: (amount: BN, signer = owner, from = ownerTokens) =>
      program.methods
        .deposit(amount)
        .accountsStrict({
          owner: signer.publicKey,
          policy,
          mint,
          ownerTokenAccount: from,
          vault,
          tokenProgram,
        })
        .instruction(),
    pay: (amount: BN, recipient: PublicKey, signer = spender) =>
      program.methods
        .pay(amount)
        .accountsStrict({
          spender: signer.publicKey,
          policy,
          mint,
          vault,
          recipient,
          tokenProgram,
        })
        .instruction(),
    withdraw: (amount: BN, destination = ownerTokens, signer = owner) =>
      program.methods
        .withdraw(amount)
        .accountsStrict({
          owner: signer.publicKey,
          policy,
          mint,
          vault,
          destination,
          tokenProgram,
        })
        .instruction(),
    updateLimits: (maxPerPayment: BN, dailyLimit: BN, signer = owner) =>
      program.methods
        .updateLimits(maxPerPayment, dailyLimit)
        .accountsStrict({ owner: signer.publicKey, policy })
        .instruction(),
    addProvider: (provider: PublicKey, signer = owner) =>
      program.methods
        .addProvider(provider)
        .accountsStrict({ owner: signer.publicKey, policy })
        .instruction(),
    removeProvider: (provider: PublicKey, signer = owner) =>
      program.methods
        .removeProvider(provider)
        .accountsStrict({ owner: signer.publicKey, policy })
        .instruction(),
    setPaused: (paused: boolean, signer = owner) =>
      program.methods
        .setPaused(paused)
        .accountsStrict({ owner: signer.publicKey, policy })
        .instruction(),
    closePolicy: (destination = ownerTokens, signer = owner) =>
      program.methods
        .closePolicy()
        .accountsStrict({
          owner: signer.publicKey,
          policy,
          mint,
          vault,
          destination,
          tokenProgram,
        })
        .instruction(),
  };

  return {
    h,
    owner,
    spender,
    stranger,
    dataApi,
    computeApi,
    unknownApi,
    mint,
    ownerTokens,
    dataApiTokens,
    computeApiTokens,
    unknownApiTokens,
    policy,
    vault,
    ix,
  };
}

/** setup() plus the standard funded policy: $100 deposited, data.api and compute.api allowed. */
async function funded(tokenProgram: PublicKey = TOKEN_PROGRAM_ID) {
  const t = setup(tokenProgram);
  expectOk(
    await t.h.sendIx(
      t.ix.createPolicy([t.dataApi.publicKey, t.computeApi.publicKey]),
      [t.owner]
    )
  );
  expectOk(await t.h.sendIx(t.ix.deposit(BUDGET), [t.owner]));
  return t;
}

const bnEq = (actual: BN, expected: BN) =>
  expect(actual.toString()).to.equal(expected.toString());

describe("xero_policy", () => {
  describe("create_policy and deposit", () => {
    it("creates the policy PDA and vault with the configured limits", async () => {
      const t = await funded();
      const policy = t.h.fetchPolicy(t.policy);

      expect(policy.owner.toBase58()).to.equal(t.owner.publicKey.toBase58());
      expect(policy.spender.toBase58()).to.equal(
        t.spender.publicKey.toBase58()
      );
      expect(policy.mint.toBase58()).to.equal(t.mint.toBase58());
      bnEq(policy.maxPerPayment, MAX_PAYMENT);
      bnEq(policy.dailyLimit, DAILY_LIMIT);
      bnEq(policy.spentInWindow, new BN(0));
      expect(policy.allowlistCount).to.equal(2);
      expect(policy.paused).to.equal(false);
      bnEq(t.h.tokenBalance(t.vault), BUDGET);
      bnEq(t.h.tokenBalance(t.ownerTokens), usd(900));
    });

    it("rejects a zero deposit", async () => {
      const t = await funded();
      expectError(
        await t.h.sendIx(t.ix.deposit(new BN(0)), [t.owner]),
        "ZeroAmount"
      );
    });

    it("rejects duplicate providers at creation", async () => {
      const t = setup();
      const p = t.dataApi.publicKey;
      expectError(
        await t.h.sendIx(t.ix.createPolicy([p, p]), [t.owner]),
        "DuplicateProvider"
      );
    });

    it("rejects more than 8 providers at creation", async () => {
      const t = setup();
      const nine = Array.from(
        { length: 9 },
        () => web3.Keypair.generate().publicKey
      );
      expectError(
        await t.h.sendIx(t.ix.createPolicy(nine), [t.owner]),
        "AllowlistFull"
      );
    });

    it("rejects zero limits and a max payment above the daily limit (InvalidLimits)", async () => {
      const t = setup();
      const allow = [t.dataApi.publicKey];
      for (const [max, daily] of [
        [new BN(0), DAILY_LIMIT],
        [MAX_PAYMENT, new BN(0)],
        [usd(21), usd(20)],
      ]) {
        expectError(
          await t.h.sendIx(t.ix.createPolicy(allow, t.owner, max, daily), [
            t.owner,
          ]),
          "InvalidLimits"
        );
      }
      // Equal limits are fine.
      expectOk(
        await t.h.sendIx(t.ix.createPolicy(allow, t.owner, usd(20), usd(20)), [
          t.owner,
        ])
      );
    });
  });

  describe("pay", () => {
    it("happy path: pays $0.42 to an allowlisted provider and emits PaymentSettled", async () => {
      const t = await funded();
      const result = expectOk(
        await t.h.sendIx(t.ix.pay(usd(0.42), t.dataApiTokens), [t.spender])
      );

      bnEq(t.h.tokenBalance(t.dataApiTokens), usd(0.42));
      bnEq(t.h.tokenBalance(t.vault), usd(99.58));
      const policy = t.h.fetchPolicy(t.policy);
      bnEq(policy.spentInWindow, usd(0.42));
      expect(policy.windowStart.toNumber()).to.equal(t.h.now());

      // Anchor 1.2's EventParser keeps the IDL's snake_case field names (accounts are camelCased).
      const [event] = parseEvents(result);
      expect(event.name).to.equal("PaymentSettled");
      expect(event.data.policy.toBase58()).to.equal(t.policy.toBase58());
      expect(event.data.spender.toBase58()).to.equal(
        t.spender.publicKey.toBase58()
      );
      expect(event.data.recipient.toBase58()).to.equal(
        t.dataApi.publicKey.toBase58()
      );
      bnEq(event.data.amount, usd(0.42));
      bnEq(event.data.spent_in_window, usd(0.42));
    });

    it("allows a payment of exactly max_per_payment", async () => {
      const t = await funded();
      expectOk(
        await t.h.sendIx(t.ix.pay(MAX_PAYMENT, t.computeApiTokens), [t.spender])
      );
      bnEq(t.h.tokenBalance(t.computeApiTokens), MAX_PAYMENT);
    });

    it("rejects an amount over max_per_payment", async () => {
      const t = await funded();
      expectError(
        await t.h.sendIx(t.ix.pay(usd(5.01), t.dataApiTokens), [t.spender]),
        "AmountExceedsMaxPayment"
      );
      expectError(
        await t.h.sendIx(t.ix.pay(usd(40), t.dataApiTokens), [t.spender]),
        "AmountExceedsMaxPayment"
      );
      bnEq(t.h.tokenBalance(t.vault), BUDGET);
    });

    it("rejects a zero amount", async () => {
      const t = await funded();
      expectError(
        await t.h.sendIx(t.ix.pay(new BN(0), t.dataApiTokens), [t.spender]),
        "ZeroAmount"
      );
    });

    it("rejects payments that would exceed the daily limit", async () => {
      const t = await funded();
      for (let i = 0; i < 4; i++) {
        expectOk(
          await t.h.sendIx(t.ix.pay(usd(5), t.dataApiTokens), [t.spender])
        );
        t.h.advance(60);
      }
      bnEq(t.h.fetchPolicy(t.policy).spentInWindow, DAILY_LIMIT);

      expectError(
        await t.h.sendIx(t.ix.pay(usd(0.01), t.computeApiTokens), [t.spender]),
        "DailyLimitExceeded"
      );
      bnEq(t.h.tokenBalance(t.dataApiTokens), DAILY_LIMIT);
      bnEq(t.h.tokenBalance(t.vault), usd(80));
    });

    it("rejects a payment that would cross the limit even when below it", async () => {
      const t = await funded();
      for (let i = 0; i < 3; i++) {
        expectOk(
          await t.h.sendIx(t.ix.pay(usd(5), t.dataApiTokens), [t.spender])
        );
      }
      expectOk(
        await t.h.sendIx(t.ix.pay(usd(4.5), t.dataApiTokens), [t.spender])
      );
      // $19.50 spent: $0.50 fits, $0.51 does not.
      expectError(
        await t.h.sendIx(t.ix.pay(usd(0.51), t.dataApiTokens), [t.spender]),
        "DailyLimitExceeded"
      );
      expectOk(
        await t.h.sendIx(t.ix.pay(usd(0.5), t.dataApiTokens), [t.spender])
      );
    });

    it("resets the rolling window 24h after the window's first payment", async () => {
      const t = await funded();
      const windowStart = t.h.now();
      for (let i = 0; i < 4; i++) {
        expectOk(
          await t.h.sendIx(t.ix.pay(usd(5), t.dataApiTokens), [t.spender])
        );
        t.h.advance(3600);
      }

      // One second before the window ends, the limit still applies.
      t.h.setTime(windowStart + DAY - 1);
      expectError(
        await t.h.sendIx(t.ix.pay(usd(1), t.dataApiTokens), [t.spender]),
        "DailyLimitExceeded"
      );

      t.h.setTime(windowStart + DAY);
      expectOk(
        await t.h.sendIx(t.ix.pay(usd(1), t.dataApiTokens), [t.spender])
      );
      const policy = t.h.fetchPolicy(t.policy);
      bnEq(policy.spentInWindow, usd(1));
      expect(policy.windowStart.toNumber()).to.equal(windowStart + DAY);

      // The new window is a full $20 again: $1 + $5 x 3 + $4 = $20, then nothing more.
      for (const amount of [5, 5, 5, 4]) {
        expectOk(
          await t.h.sendIx(t.ix.pay(usd(amount), t.dataApiTokens), [t.spender])
        );
      }
      expectError(
        await t.h.sendIx(t.ix.pay(usd(0.01), t.dataApiTokens), [t.spender]),
        "DailyLimitExceeded"
      );
    });

    it("rejects a recipient whose owner is not allowlisted", async () => {
      const t = await funded();
      expectError(
        await t.h.sendIx(t.ix.pay(usd(0.42), t.unknownApiTokens), [t.spender]),
        "RecipientNotAllowed"
      );
      bnEq(t.h.tokenBalance(t.unknownApiTokens), new BN(0));
    });

    it("checks allowlist before amount (unknown.api, $40 → RecipientNotAllowed)", async () => {
      const t = await funded();
      expectError(
        await t.h.sendIx(t.ix.pay(usd(40), t.unknownApiTokens), [t.spender]),
        "RecipientNotAllowed"
      );
    });

    it("rejects a recipient token account for a different mint", async () => {
      const t = await funded();
      const otherMint = t.h.createMint(t.owner);
      const wrongMintAccount = t.h.createTokenAccount(
        t.owner,
        otherMint,
        t.dataApi.publicKey
      );
      expectError(
        await t.h.sendIx(t.ix.pay(usd(1), wrongMintAccount), [t.spender]),
        "ConstraintTokenMint"
      );
    });
  });

  describe("pause (kill switch)", () => {
    it("blocks payments while paused and allows them again after unpausing", async () => {
      const t = await funded();
      expectOk(await t.h.sendIx(t.ix.setPaused(true), [t.owner]));
      expect(t.h.fetchPolicy(t.policy).paused).to.equal(true);
      expectError(
        await t.h.sendIx(t.ix.pay(usd(0.42), t.dataApiTokens), [t.spender]),
        "Paused"
      );

      expectOk(await t.h.sendIx(t.ix.setPaused(false), [t.owner]));
      expectOk(
        await t.h.sendIx(t.ix.pay(usd(0.42), t.dataApiTokens), [t.spender])
      );
      bnEq(t.h.tokenBalance(t.dataApiTokens), usd(0.42));
    });

    it("reports Paused before any other policy violation", async () => {
      const t = await funded();
      expectOk(await t.h.sendIx(t.ix.setPaused(true), [t.owner]));
      expectError(
        await t.h.sendIx(t.ix.pay(usd(40), t.unknownApiTokens), [t.spender]),
        "Paused"
      );
    });

    it("lets the owner withdraw everything while paused", async () => {
      const t = await funded();
      expectOk(
        await t.h.sendIx(t.ix.pay(usd(3), t.dataApiTokens), [t.spender])
      );
      expectOk(await t.h.sendIx(t.ix.setPaused(true), [t.owner]));

      expectOk(await t.h.sendIx(t.ix.withdraw(usd(97)), [t.owner]));
      bnEq(t.h.tokenBalance(t.vault), new BN(0));
      bnEq(t.h.tokenBalance(t.ownerTokens), usd(997));
    });

    it("rejects a withdrawal larger than the vault balance", async () => {
      const t = await funded();
      const result = await t.h.sendIx(t.ix.withdraw(usd(100.01)), [t.owner]);
      expect(result).to.have.property("err");
      expect(
        (result as { meta(): { logs(): string[] } }).meta().logs().join("\n")
      ).to.include("insufficient funds");
      bnEq(t.h.tokenBalance(t.vault), BUDGET);
    });
  });

  describe("authorization", () => {
    it("rejects pay signed by anyone other than the spender", async () => {
      const t = await funded();
      expectError(
        await t.h.sendIx(t.ix.pay(usd(0.42), t.dataApiTokens, t.stranger), [
          t.stranger,
        ]),
        "Unauthorized"
      );
      // The owner is not the spender either.
      expectError(
        await t.h.sendIx(t.ix.pay(usd(0.42), t.dataApiTokens, t.owner), [
          t.owner,
        ]),
        "Unauthorized"
      );
    });

    it("rejects owner-only instructions from the spender or a stranger", async () => {
      const t = await funded();
      for (const signer of [t.spender, t.stranger]) {
        const attempts = [
          t.ix.updateLimits(usd(1000), usd(1000), signer),
          t.ix.addProvider(t.unknownApi.publicKey, signer),
          t.ix.removeProvider(t.dataApi.publicKey, signer),
          t.ix.setPaused(true, signer),
          t.ix.withdraw(usd(1), t.ownerTokens, signer),
        ];
        for (const attempt of attempts) {
          expectError(await t.h.sendIx(attempt, [signer]), "Unauthorized");
        }
      }
      // Nothing changed.
      const policy = t.h.fetchPolicy(t.policy);
      bnEq(policy.maxPerPayment, MAX_PAYMENT);
      expect(policy.allowlistCount).to.equal(2);
      expect(policy.paused).to.equal(false);
      bnEq(t.h.tokenBalance(t.vault), BUDGET);
    });

    it("rejects a deposit signed by someone other than the owner", async () => {
      const t = await funded();
      const strangerTokens = t.h.createTokenAccount(
        t.owner,
        t.mint,
        t.stranger.publicKey
      );
      t.h.mintTo(t.owner, t.mint, strangerTokens, usd(10));
      expectError(
        await t.h.sendIx(t.ix.deposit(usd(10), t.stranger, strangerTokens), [
          t.stranger,
        ]),
        "Unauthorized"
      );
    });

    it("rejects a pay transaction that is missing the spender's signature", async () => {
      const t = await funded();
      const ix = await t.ix.pay(usd(0.42), t.dataApiTokens);
      // Strip the signer flag so the transaction can be sent without the spender's key.
      ix.keys = ix.keys.map((k) =>
        k.pubkey.equals(t.spender.publicKey) ? { ...k, isSigner: false } : k
      );
      const result = t.h.send([ix], [t.stranger]);
      expect(result).to.have.property("err");
      expect(
        (result as { meta(): { logs(): string[] } }).meta().logs().join("\n")
      ).to.include("AccountNotSigner");
    });
  });

  describe("update_limits", () => {
    it("applies new limits to subsequent payments", async () => {
      const t = await funded();
      expectError(
        await t.h.sendIx(t.ix.pay(usd(8), t.dataApiTokens), [t.spender]),
        "AmountExceedsMaxPayment"
      );
      expectOk(
        await t.h.sendIx(t.ix.updateLimits(usd(10), usd(30)), [t.owner])
      );
      expectOk(
        await t.h.sendIx(t.ix.pay(usd(8), t.dataApiTokens), [t.spender])
      );

      const policy = t.h.fetchPolicy(t.policy);
      bnEq(policy.maxPerPayment, usd(10));
      bnEq(policy.dailyLimit, usd(30));
    });

    it("lowering the daily limit below what is already spent blocks further payments", async () => {
      const t = await funded();
      expectOk(
        await t.h.sendIx(t.ix.pay(usd(5), t.dataApiTokens), [t.spender])
      );
      expectOk(await t.h.sendIx(t.ix.updateLimits(usd(4), usd(4)), [t.owner]));
      expectError(
        await t.h.sendIx(t.ix.pay(usd(0.01), t.dataApiTokens), [t.spender]),
        "DailyLimitExceeded"
      );
    });
  });

  describe("update_limits validation", () => {
    it("rejects invalid limits and leaves the old ones in place", async () => {
      const t = await funded();
      for (const [max, daily] of [
        [new BN(0), usd(20)],
        [usd(5), new BN(0)],
        [usd(10), usd(9.99)],
      ]) {
        expectError(
          await t.h.sendIx(t.ix.updateLimits(max, daily), [t.owner]),
          "InvalidLimits"
        );
      }
      const policy = t.h.fetchPolicy(t.policy);
      bnEq(policy.maxPerPayment, MAX_PAYMENT);
      bnEq(policy.dailyLimit, DAILY_LIMIT);
    });
  });

  describe("close_policy", () => {
    it("sweeps the vault to the owner, closes both accounts and refunds their rent", async () => {
      const t = await funded();
      expectOk(
        await t.h.sendIx(t.ix.pay(usd(0.42), t.dataApiTokens), [t.spender])
      );
      const rent = t.h.lamports(t.policy) + t.h.lamports(t.vault);
      const ownerLamports = t.h.lamports(t.owner.publicKey);

      expectOk(await t.h.sendIx(t.ix.closePolicy(), [t.owner]));
      expect(t.h.exists(t.policy)).to.equal(false);
      expect(t.h.exists(t.vault)).to.equal(false);
      bnEq(t.h.tokenBalance(t.ownerTokens), usd(999.58));
      // The owner also paid the 5000-lamport fee for the close transaction.
      expect(t.h.lamports(t.owner.publicKey)).to.equal(
        ownerLamports + rent - 5000n
      );
    });

    it("works while paused and on an empty vault, and the policy can be created again", async () => {
      const t = await funded();
      expectOk(await t.h.sendIx(t.ix.withdraw(BUDGET), [t.owner]));
      expectOk(await t.h.sendIx(t.ix.setPaused(true), [t.owner]));
      expectOk(await t.h.sendIx(t.ix.closePolicy(), [t.owner]));
      expect(t.h.exists(t.policy)).to.equal(false);

      expectOk(
        await t.h.sendIx(t.ix.createPolicy([t.dataApi.publicKey]), [t.owner])
      );
      const policy = t.h.fetchPolicy(t.policy);
      expect(policy.paused).to.equal(false);
      bnEq(policy.spentInWindow, new BN(0));
    });

    it("rejects close from the spender or a stranger", async () => {
      const t = await funded();
      for (const signer of [t.spender, t.stranger]) {
        expectError(
          await t.h.sendIx(t.ix.closePolicy(t.ownerTokens, signer), [signer]),
          "Unauthorized"
        );
      }
      bnEq(t.h.tokenBalance(t.vault), BUDGET);
    });

    it("rejects paying from a closed policy", async () => {
      const t = await funded();
      expectOk(await t.h.sendIx(t.ix.closePolicy(), [t.owner]));
      expectError(
        await t.h.sendIx(t.ix.pay(usd(0.42), t.dataApiTokens), [t.spender]),
        "AccountNotInitialized"
      );
    });
  });

  describe("add_provider / remove_provider", () => {
    it("adds a provider that can then be paid", async () => {
      const t = await funded();
      expectOk(
        await t.h.sendIx(t.ix.addProvider(t.unknownApi.publicKey), [t.owner])
      );
      expect(t.h.fetchPolicy(t.policy).allowlistCount).to.equal(3);
      expectOk(
        await t.h.sendIx(t.ix.pay(usd(1), t.unknownApiTokens), [t.spender])
      );
    });

    it("removes a provider so it can no longer be paid", async () => {
      const t = await funded();
      expectOk(
        await t.h.sendIx(t.ix.removeProvider(t.dataApi.publicKey), [t.owner])
      );
      const policy = t.h.fetchPolicy(t.policy);
      expect(policy.allowlistCount).to.equal(1);
      expect(policy.allowlist[0].toBase58()).to.equal(
        t.computeApi.publicKey.toBase58()
      );

      expectError(
        await t.h.sendIx(t.ix.pay(usd(1), t.dataApiTokens), [t.spender]),
        "RecipientNotAllowed"
      );
      expectOk(
        await t.h.sendIx(t.ix.pay(usd(1), t.computeApiTokens), [t.spender])
      );
    });

    it("rejects a duplicate provider", async () => {
      const t = await funded();
      expectError(
        await t.h.sendIx(t.ix.addProvider(t.dataApi.publicKey), [t.owner]),
        "DuplicateProvider"
      );
    });

    it("rejects a 9th provider, and accepts one again after a removal", async () => {
      const t = await funded();
      const extra = Array.from(
        { length: 6 },
        () => web3.Keypair.generate().publicKey
      );
      for (const provider of extra) {
        expectOk(await t.h.sendIx(t.ix.addProvider(provider), [t.owner]));
      }
      expect(t.h.fetchPolicy(t.policy).allowlistCount).to.equal(8);

      expectError(
        await t.h.sendIx(t.ix.addProvider(t.unknownApi.publicKey), [t.owner]),
        "AllowlistFull"
      );

      expectOk(await t.h.sendIx(t.ix.removeProvider(extra[2]), [t.owner]));
      expectOk(
        await t.h.sendIx(t.ix.addProvider(t.unknownApi.publicKey), [t.owner])
      );
      const policy = t.h.fetchPolicy(t.policy);
      expect(policy.allowlistCount).to.equal(8);
      const listed = policy.allowlist.map((p: PublicKey) => p.toBase58());
      expect(listed).to.include(t.unknownApi.publicKey.toBase58());
      expect(listed).not.to.include(extra[2].toBase58());
    });

    it("rejects removing a provider that is not on the list", async () => {
      const t = await funded();
      expectError(
        await t.h.sendIx(t.ix.removeProvider(t.unknownApi.publicKey), [
          t.owner,
        ]),
        "ProviderNotFound"
      );
    });
  });

  describe("Token-2022", () => {
    it("runs create, deposit, pay and withdraw with a Token-2022 mint", async () => {
      const t = await funded(TOKEN_2022_PROGRAM_ID);
      bnEq(t.h.tokenBalance(t.vault), BUDGET);

      expectOk(
        await t.h.sendIx(t.ix.pay(usd(0.42), t.dataApiTokens), [t.spender])
      );
      bnEq(t.h.tokenBalance(t.dataApiTokens), usd(0.42));
      expectError(
        await t.h.sendIx(t.ix.pay(usd(5.01), t.dataApiTokens), [t.spender]),
        "AmountExceedsMaxPayment"
      );

      expectOk(await t.h.sendIx(t.ix.withdraw(usd(99.58)), [t.owner]));
      bnEq(t.h.tokenBalance(t.vault), new BN(0));
    });

    it("accepts a mint whose only extension is a close authority", async () => {
      const t = setup(TOKEN_2022_PROGRAM_ID, (h, authority) =>
        h.createMintWithExtensions(
          authority,
          [ExtensionType.MintCloseAuthority],
          (mint) => [
            createInitializeMintCloseAuthorityInstruction(
              mint,
              authority.publicKey,
              TOKEN_2022_PROGRAM_ID
            ),
          ]
        )
      );
      expectOk(
        await t.h.sendIx(t.ix.createPolicy([t.dataApi.publicKey]), [t.owner])
      );
    });

    it("rejects mints with transfer fees or a permanent delegate (UnsupportedMint)", async () => {
      const withFee = setup(TOKEN_2022_PROGRAM_ID, (h, authority) =>
        h.createMintWithExtensions(
          authority,
          [ExtensionType.TransferFeeConfig],
          (mint) => [
            createInitializeTransferFeeConfigInstruction(
              mint,
              authority.publicKey,
              authority.publicKey,
              100,
              BigInt(1_000_000),
              TOKEN_2022_PROGRAM_ID
            ),
          ]
        )
      );
      expectError(
        await withFee.h.sendIx(
          withFee.ix.createPolicy([withFee.dataApi.publicKey]),
          [withFee.owner]
        ),
        "UnsupportedMint"
      );

      const withDelegate = setup(TOKEN_2022_PROGRAM_ID, (h, authority) =>
        h.createMintWithExtensions(
          authority,
          [ExtensionType.PermanentDelegate],
          (mint) => [
            createInitializePermanentDelegateInstruction(
              mint,
              authority.publicKey,
              TOKEN_2022_PROGRAM_ID
            ),
          ]
        )
      );
      expectError(
        await withDelegate.h.sendIx(
          withDelegate.ix.createPolicy([withDelegate.dataApi.publicKey]),
          [withDelegate.owner]
        ),
        "UnsupportedMint"
      );
    });
  });
});
