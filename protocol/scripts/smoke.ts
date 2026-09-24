/**
 * Runs the website example against a live cluster (localnet by default):
 * create a policy ($5 max, $20/day, data.api + compute.api), deposit $100, pay $0.42,
 * then confirm a $40 payment is rejected. Uses a fresh 6-decimal test mint every run.
 *
 *   npm run smoke                                  # http://127.0.0.1:8899
 *   RPC_URL=<url> npm run smoke                    # any other cluster
 */
import { AnchorProvider, BN, Program, Wallet, web3 } from "@anchor-lang/core";
import {
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { readFileSync } from "fs";
import { homedir } from "os";
import type { XeroPolicy } from "../target/types/xero_policy";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const WALLET = process.env.WALLET ?? `${homedir()}/.config/solana/id.json`;
const usd = (dollars: number) => new BN(Math.round(dollars * 1e6));

async function main() {
  const connection = new web3.Connection(RPC_URL, "confirmed");
  const owner = web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(WALLET, "utf8")))
  );
  const provider = new AnchorProvider(connection, new Wallet(owner), {
    commitment: "confirmed",
  });
  const idl: XeroPolicy = JSON.parse(
    readFileSync(`${__dirname}/../target/idl/xero_policy.json`, "utf8")
  );
  const program = new Program<XeroPolicy>(idl, provider);
  console.log(`cluster ${RPC_URL}\nprogram ${program.programId.toBase58()}`);

  const spender = web3.Keypair.generate();
  const dataApi = web3.Keypair.generate();
  const computeApi = web3.Keypair.generate();
  // The spender pays its own transaction fees.
  await provider.sendAndConfirm(
    new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: spender.publicKey,
        lamports: 0.05 * web3.LAMPORTS_PER_SOL,
      })
    )
  );

  const mint = await createMint(connection, owner, owner.publicKey, null, 6);
  const ownerTokens = await createAccount(
    connection,
    owner,
    mint,
    owner.publicKey
  );
  await mintTo(
    connection,
    owner,
    mint,
    ownerTokens,
    owner,
    BigInt(usd(1000).toString())
  );
  const dataApiTokens = await createAccount(
    connection,
    owner,
    mint,
    dataApi.publicKey
  );

  const [policy] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("policy"),
      owner.publicKey.toBuffer(),
      spender.publicKey.toBuffer(),
    ],
    program.programId
  );
  const [vault] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), policy.toBuffer()],
    program.programId
  );

  await program.methods
    .createPolicy(spender.publicKey, usd(5), usd(20), [
      dataApi.publicKey,
      computeApi.publicKey,
    ])
    .accountsPartial({
      owner: owner.publicKey,
      policy,
      mint,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  await program.methods
    .deposit(usd(100))
    .accountsPartial({
      owner: owner.publicKey,
      policy,
      mint,
      ownerTokenAccount: ownerTokens,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  const paySig = await program.methods
    .pay(usd(0.42))
    .accountsPartial({
      spender: spender.publicKey,
      policy,
      mint,
      vault,
      recipient: dataApiTokens,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([spender])
    .rpc();
  console.log(`pay $0.42 → data.api: ${paySig}`);

  try {
    await program.methods
      .pay(usd(40))
      .accountsPartial({
        spender: spender.publicKey,
        policy,
        mint,
        vault,
        recipient: dataApiTokens,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([spender])
      .rpc();
    throw new Error("expected the $40 payment to be rejected");
  } catch (err) {
    const message = String(err);
    if (!message.includes("AmountExceedsMaxPayment")) throw err;
    console.log("pay $40 → rejected with AmountExceedsMaxPayment");
  }

  const vaultBalance = (await getAccount(connection, vault)).amount;
  const providerBalance = (await getAccount(connection, dataApiTokens)).amount;
  const state = await program.account.policy.fetch(policy);
  console.log(
    `vault ${vaultBalance} · data.api ${providerBalance} · spent_in_window ${state.spentInWindow}`
  );
  if (vaultBalance !== 99_580_000n || providerBalance !== 420_000n) {
    throw new Error("unexpected balances");
  }
  console.log("smoke test passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
