import { TOKEN_2022_PROGRAM_ID, getAccount } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  InvalidAmountError,
  PolicyViolation,
  type PolicyViolationCode,
  type Spender,
  ZeroError,
  ZeroProgramError,
  parsePaymentSettled,
} from "../src/index.js";
import { type Localnet, startLocalnet, usd, world } from "./localnet.js";

let localnet: Localnet;
before(async () => {
  localnet = await startLocalnet();
});
after(async () => {
  await localnet?.stop();
});

/** The website's policy: $100 budget, $5 max payment, $20/day, data.api + compute.api. */
async function websitePolicy(tokenProgram?: typeof TOKEN_2022_PROGRAM_ID) {
  const w = await world(localnet.rpcUrl, tokenProgram);
  const spender = await w.zero.createSpender({
    spender: w.agent.publicKey,
    mint: w.mint,
    deposit: "100",
    maxPerPayment: "5",
    dailyLimit: "20",
    allowedProviders: [w.dataApi, w.computeApi],
  });
  return { ...w, spender, agent: spender.as(w.agentWallet) };
}

/** Asserts that `promise` rejects with a PolicyViolation of `code` from `source`. */
async function rejectsWith(
  promise: Promise<unknown>,
  code: PolicyViolationCode,
  source: "check" | "chain",
) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof PolicyViolation, `expected PolicyViolation, got ${err}`);
    assert.equal(err.code, code);
    assert.equal(err.source, source);
    return true;
  });
}

describe("website flow", () => {
  it("creates with $100, pays $0.42, $1.20, $0.80, $3.00, then refuses $40 to unknown.api without sending", async () => {
    const w = await websitePolicy();
    assert.equal(w.connection.sent, 1, "create + deposit is one transaction");

    const status = await w.spender.status();
    assert.equal(status.balance.decimal, "100");
    assert.equal(status.limits.maxPerPayment.decimal, "5");
    assert.equal(status.limits.dailyLimit.decimal, "20");
    assert.deepEqual(status.allowlist.map(String), [w.dataApi, w.computeApi].map(String));
    assert.equal(status.paused, false);
    assert.equal(status.remainingToday.decimal, "20");
    assert.equal(status.nextReleaseAt, null);

    const payments = [
      { to: w.dataApi, amount: "0.42", spent: "0.42", remaining: "19.58" },
      { to: w.computeApi, amount: "1.20", spent: "1.62", remaining: "18.38" },
      { to: w.dataApi, amount: "0.80", spent: "2.42", remaining: "17.58" },
      { to: w.computeApi, amount: "3.00", spent: "5.42", remaining: "14.58" },
    ];
    for (const p of payments) {
      const result = await w.agent.pay({ recipient: p.to, amount: p.amount });
      assert.equal(result.status, "settled");
      assert.match(result.signature, /^[1-9A-HJ-NP-Za-km-z]{64,88}$/);
      assert.equal(result.amount.raw, usd(p.amount));
      assert.equal(result.spentInWindow.decimal, p.spent);
      assert.equal(result.remainingToday.decimal, p.remaining);
      assert.ok(result.event.recipient.equals(p.to));
      assert.ok(result.event.spender.equals(w.agent.spender));
    }
    assert.equal(w.connection.sent, 5);

    await rejectsWith(
      w.agent.pay({ recipient: w.unknownApi, amount: "40" }),
      "RecipientNotAllowed",
      "check",
    );
    assert.equal(w.connection.sent, 5, "no transaction was sent for the refused payment");

    const after = await w.spender.status();
    assert.equal(after.balance.decimal, "94.58");
    assert.equal(after.spentInWindow.decimal, "5.42");
    assert.equal(after.remainingToday.decimal, "14.58");
    assert.ok(after.nextReleaseAt instanceof Date);
    assert.equal(await w.balance(w.dataApiTokens), usd("1.22"));
    assert.equal(await w.balance(w.computeApiTokens), usd("4.2"));
    assert.equal(await w.balance(w.unknownApiTokens), 0n);
  });

  it("parsePaymentSettled reads the event from the confirmed transaction", async () => {
    const w = await websitePolicy();
    const { signature } = await w.agent.pay({ recipient: w.dataApi, amount: "0.42" });
    const tx = await w.connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const [event, ...rest] = parsePaymentSettled(tx!.meta!.logMessages!);
    assert.equal(rest.length, 0);
    assert.ok(event.policy.equals(w.spender.policy));
    assert.ok(event.spender.equals(w.agent.spender));
    assert.ok(event.recipient.equals(w.dataApi));
    assert.equal(event.amount, 420_000n);
    assert.equal(event.spentInWindow, 420_000n);
    assert.ok(event.mint.equals(w.mint));
    assert.ok(event.recipientTokenAccount.equals(w.dataApiTokens));
    assert.equal(event.dailyLimit, 20_000_000n);
    assert.ok(event.timestamp > 1_700_000_000n);
  });

  it("getSpender loads an existing policy for the owner and for the agent", async () => {
    const w = await websitePolicy();
    const loaded = await w.zero.getSpender(w.owner.publicKey, w.agent.spender);
    assert.ok(loaded.policy.equals(w.spender.policy));
    assert.equal(loaded.mint.decimals, 6);
    assert.equal((await loaded.status()).balance.decimal, "100");

    const { ZeroClient } = await import("../src/index.js");
    const agentClient = new ZeroClient({ connection: w.connection, wallet: w.agentWallet });
    const asAgent = await agentClient.getSpender(w.owner.publicKey, w.agent.spender);
    const result = await asAgent.pay({ recipient: w.computeApi, amount: "2.5" });
    assert.equal(result.remainingToday.decimal, "17.5");

    await assert.rejects(
      w.zero.getSpender(w.owner.publicKey, Keypair.generate().publicKey),
      (err: unknown) => err instanceof ZeroError && err.code === "PolicyNotFound",
    );
  });
});

describe("check() matches the program", () => {
  /**
   * For each case: check() must refuse with `code`, and the same payment sent with the check
   * bypassed must be rejected by the chain with the same code.
   */
  async function agree(
    spender: Spender,
    recipient: Keypair["publicKey"],
    amount: string,
    code: PolicyViolationCode,
  ) {
    const local = await spender.check({ recipient, amount });
    assert.deepEqual(
      local.allowed ? local : { allowed: local.allowed, code: local.code },
      { allowed: false, code },
      `check() for ${amount} should be ${code}`,
    );
    assert.ok(!local.allowed && local.reason.length > 0);
    await rejectsWith(spender.pay({ recipient, amount }, { skipCheck: true }), code, "chain");
  }

  it("agrees on every rejection, including the ordering cases", async () => {
    const w = await websitePolicy();
    const agent = w.agent;

    await agree(agent, w.unknownApi, "0.42", "RecipientNotAllowed");
    await agree(agent, w.unknownApi, "40", "RecipientNotAllowed"); // allowlist before amount
    await agree(agent, w.dataApi, "0", "ZeroAmount");
    await agree(agent, w.dataApi, "5.01", "AmountExceedsMaxPayment");
    await agree(agent, w.dataApi, "40", "AmountExceedsMaxPayment");

    await w.spender.pause();
    await agree(agent, w.dataApi, "0.42", "Paused");
    await agree(agent, w.unknownApi, "40", "Paused"); // paused before everything
    await w.spender.resume();

    // Vault balance: leave $1 in the vault, then try $2 (within every limit).
    await w.spender.withdraw({ amount: "99" });
    await agree(agent, w.dataApi, "2", "InsufficientFunds");
    await w.spender.deposit({ amount: "99" });

    // Daily limit: $5 x 4 = $20, then even $0.01 is over.
    for (let i = 0; i < 4; i++) await agent.pay({ recipient: w.dataApi, amount: "5" });
    await agree(agent, w.dataApi, "0.01", "DailyLimitExceeded");

    // And an allowed payment is allowed by both.
    await w.spender.updateLimits({ maxPerPayment: "5", dailyLimit: "21" });
    assert.deepEqual(await agent.check({ recipient: w.computeApi, amount: "1" }), {
      allowed: true,
    });
    await agent.pay({ recipient: w.computeApi, amount: "1" });
  });

  it("maps chain rejections that landed on chain (skipPreflight) to the same PolicyViolation", async () => {
    const w = await websitePolicy();
    const before = w.connection.sent;
    await assert.rejects(
      w.agent.pay(
        { recipient: w.unknownApi, amount: "40" },
        { skipCheck: true, skipPreflight: true },
      ),
      (err: unknown) => {
        assert.ok(err instanceof PolicyViolation);
        assert.equal(err.code, "RecipientNotAllowed");
        assert.equal(err.source, "chain");
        assert.ok(err.logs.some((l) => l.includes("Error Code: RecipientNotAllowed")));
        return true;
      },
    );
    assert.equal(w.connection.sent, before + 1);
    assert.equal((await w.spender.status()).balance.decimal, "100");
  });

  it("maps non-payment program errors to ZeroProgramError", async () => {
    const w = await websitePolicy();
    await assert.rejects(w.spender.addProvider(w.dataApi), (err: unknown) => {
      assert.ok(err instanceof ZeroProgramError);
      assert.equal(err.code, "DuplicateProvider");
      assert.equal(err.errorNumber, 6006);
      return true;
    });
    await assert.rejects(
      w.spender.removeProvider(w.unknownApi),
      (err: unknown) => err instanceof ZeroProgramError && err.code === "ProviderNotFound",
    );
  });
});

describe("local validation", () => {
  it("rejects malformed amounts before sending anything", async () => {
    const w = await websitePolicy();
    const before = w.connection.sent;
    for (const amount of ["0.4200001", "-1", "abc"]) {
      await assert.rejects(w.agent.pay({ recipient: w.dataApi, amount }), InvalidAmountError);
      await assert.rejects(w.agent.check({ recipient: w.dataApi, amount }), InvalidAmountError);
    }
    // "0.42" is fine.
    assert.deepEqual(await w.agent.check({ recipient: w.dataApi, amount: "0.42" }), {
      allowed: true,
    });
    assert.equal(w.connection.sent, before);
  });

  it("refuses invalid limits, wrong signers and a missing recipient account without sending", async () => {
    const w = await websitePolicy();
    const before = w.connection.sent;
    const code = (c: string) => (err: unknown) => err instanceof ZeroError && err.code === c;

    await assert.rejects(
      w.spender.updateLimits({ maxPerPayment: "21", dailyLimit: "20" }),
      code("InvalidLimits"),
    );
    await assert.rejects(
      w.spender.pay({ recipient: w.dataApi, amount: "1" }),
      code("Unauthorized"),
    );
    await assert.rejects(w.agent.pause(), code("Unauthorized"));
    await assert.rejects(
      w.agent.pay({ recipient: Keypair.generate().publicKey, amount: "1" }),
      code("RecipientAccountMissing"),
    );
    await assert.rejects(
      w.zero.createSpender({
        spender: Keypair.generate().publicKey,
        mint: w.mint,
        maxPerPayment: "5",
        dailyLimit: "20",
        allowedProviders: [w.dataApi, w.dataApi],
      }),
      code("DuplicateProvider"),
    );
    assert.equal(w.connection.sent, before);
  });
});

describe("owner controls", () => {
  it("pause blocks payments, withdraw works while paused, resume re-enables payments", async () => {
    const w = await websitePolicy();
    await w.spender.pause();
    assert.equal((await w.spender.status()).paused, true);
    await rejectsWith(w.agent.pay({ recipient: w.dataApi, amount: "0.42" }), "Paused", "check");

    await w.spender.withdraw({ amount: "10" });
    assert.equal((await w.spender.status()).balance.decimal, "90");
    assert.equal(await w.balance(w.ownerTokens), usd("910"));

    await w.spender.resume();
    const result = await w.agent.pay({ recipient: w.dataApi, amount: "0.42" });
    assert.equal(result.status, "settled");
  });

  it("updateLimits and add/removeProvider change what pay() allows", async () => {
    const w = await websitePolicy();
    await w.spender.addProvider(w.unknownApi);
    await w.spender.removeProvider(w.dataApi);
    await w.spender.updateLimits({ maxPerPayment: "10", dailyLimit: "30" });
    const status = await w.spender.status();
    assert.deepEqual(
      status.allowlist.map(String).sort(),
      [w.computeApi, w.unknownApi].map(String).sort(),
    );
    assert.equal(status.limits.maxPerPayment.decimal, "10");

    await w.agent.pay({ recipient: w.unknownApi, amount: "8" });
    await rejectsWith(
      w.agent.pay({ recipient: w.dataApi, amount: "1" }),
      "RecipientNotAllowed",
      "check",
    );
  });

  it("close sweeps the vault to the owner and removes the policy", async () => {
    const w = await websitePolicy();
    await w.agent.pay({ recipient: w.dataApi, amount: "0.42" });
    await w.spender.pause();
    const lamportsBefore = await w.connection.getBalance(w.owner.publicKey);

    await w.spender.close();
    assert.equal(await w.balance(w.ownerTokens), usd("999.58"));
    assert.equal(await w.connection.getAccountInfo(w.spender.policy), null);
    assert.equal(await w.connection.getAccountInfo(w.spender.vault), null);
    assert.ok((await w.connection.getBalance(w.owner.publicKey)) > lamportsBefore, "rent refunded");

    const notFound = (err: unknown) => err instanceof ZeroError && err.code === "PolicyNotFound";
    await assert.rejects(w.zero.getSpender(w.owner.publicKey, w.agent.spender), notFound);
    await assert.rejects(w.spender.status(), notFound);
  });
});

describe("Token-2022", () => {
  it("runs the same flow with a Token-2022 mint", async () => {
    const w = await websitePolicy(TOKEN_2022_PROGRAM_ID);
    assert.ok(w.spender.mint.tokenProgram.equals(TOKEN_2022_PROGRAM_ID));
    const result = await w.agent.pay({ recipient: w.dataApi, amount: "0.42" });
    assert.equal(result.remainingToday.decimal, "19.58");
    await w.spender.close();
    const owner = await getAccount(w.connection, w.ownerTokens, "confirmed", TOKEN_2022_PROGRAM_ID);
    assert.equal(owner.amount, usd("999.58"));
  });
});
