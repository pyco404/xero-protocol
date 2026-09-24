// Q1: can proofs be generated from JS/TS? Uses @solana/zk-sdk (WASM) in Node, times the proofs
// a confidential transfer needs, and has the ZK ElGamal proof program on the spike's localnet
// (:8999) verify them via simulateTransaction (sigVerify off, fee payer funded by airdrop).
//
//   node proofs.mjs
import {
  BatchedRangeProofU128Data,
  BatchedRangeProofU64Data,
  CiphertextCommitmentEqualityProofData,
  ConfidentialKeys,
  ElGamalKeypair,
  PedersenCommitment,
  PedersenOpening,
  PubkeyValidityProofData,
} from "@solana/zk-sdk";
import { createHash, randomBytes } from "node:crypto";

const RPC = "http://127.0.0.1:8999";
const ZK_PROGRAM = "ZkE1Gama1Proof11111111111111111111111111111";
// ProofInstruction discriminants (solana-zk-elgamal-proof-interface 0.1.3).
const IX = { CiphertextCommitmentEquality: 3, PubkeyValidity: 4, RangeU64: 6, RangeU128: 7 };

const rpc = async (method, params) => {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await res.json()).result;
};

function time(label, f) {
  const t = performance.now();
  const out = f();
  console.log(`  ${label.padEnd(44)} ${(performance.now() - t).toFixed(1)} ms`);
  return out;
}

// ---- minimal legacy transaction encoding (one instruction, fee payer + program) ---------------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s) {
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(B58.indexOf(c));
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const c of s) { if (c === "1") bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}
function b58encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = "1" + s; else break; }
  return s;
}
const shortvec = (n) => (n < 0x80 ? [n] : [(n & 0x7f) | 0x80, n >> 7]);
function transaction(feePayer, data) {
  const message = [
    1, 0, 1, // header: 1 signer, 0 readonly signed, 1 readonly unsigned (the program)
    ...shortvec(2), ...b58decode(feePayer), ...b58decode(ZK_PROGRAM),
    ...new Uint8Array(32), // blockhash (replaced by the simulation)
    ...shortvec(1), 1, ...shortvec(0), ...shortvec(data.length), ...data,
  ];
  return Buffer.from([...shortvec(1), ...new Uint8Array(64), ...message]);
}

async function verifyOnChain(label, feePayer, discriminant, proofBytes) {
  const tx = transaction(feePayer, Uint8Array.from([discriminant, ...proofBytes]));
  if (tx.length > 1232) {
    console.log(`  on-chain ${label.padEnd(35)} not sent inline: ${tx.length} B > 1232 B limit`);
    return;
  }
  const r = await rpc("simulateTransaction", [
    tx.toString("base64"),
    { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" },
  ]);
  const v = r.value;
  console.log(`  on-chain ${label.padEnd(35)} err=${JSON.stringify(v.err)} units=${v.unitsConsumed} (${tx.length} B)`);
}

// ---- keys --------------------------------------------------------------------------------------
console.log("[key derivation]");
const walletSeed = randomBytes(32); // stands in for an ed25519 signature / PRF output / KMS MAC
const keys = time("ConfidentialKeys.fromIkm (ElGamal + AES)", () => ConfidentialKeys.fromIkm(walletSeed));
const programId = createHash("sha256").update("program").digest();
const pda = createHash("sha256").update("pda").digest();
const seed = ConfidentialKeys.pdaWalletPublicSeed(programId, pda, randomBytes(32), randomBytes(32));
console.log(`  pdaWalletPublicSeed -> ${seed.length} bytes (program_id || wallet_pda || mint || token_account)`);
const elgamal = keys.elgamal();
const other = new ElGamalKeypair();

// ---- proofs ------------------------------------------------------------------------------------
console.log("\n[proof generation in WASM (Node)]");
const amount = 420000n;
const ciphertext = elgamal.pubkey().encryptU64(amount);
const opening = new PedersenOpening();
const commitment = PedersenCommitment.from(amount, opening);
const pubkeyValidity = time("PubkeyValidityProofData", () => new PubkeyValidityProofData(elgamal));
const equality = time("CiphertextCommitmentEqualityProofData", () =>
  new CiphertextCommitmentEqualityProofData(elgamal, ciphertext, commitment, opening, amount));
// A transfer's range proof: new balance (64) + amount lo (16) + amount hi (32) + padding (16).
const values = [99_580_000n, 26_784n, 6n, 0n];
const openings = values.map(() => new PedersenOpening());
const commitments = values.map((v, i) => PedersenCommitment.from(v, openings[i]));
const range128 = time("BatchedRangeProofU128Data (64+16+32+16 bits)", () =>
  new BatchedRangeProofU128Data(commitments, BigUint64Array.from(values), Uint8Array.from([64, 16, 32, 16]), openings));
// wasm-bindgen moves class instances passed by value: the U128 call consumed `commitments` and
// `openings`, so the U64 proof needs fresh ones.
const opening64 = new PedersenOpening();
const commitment64 = PedersenCommitment.from(values[0], opening64);
const range64 = time("BatchedRangeProofU64Data (64 bits)", () =>
  new BatchedRangeProofU64Data([commitment64], BigUint64Array.from([values[0]]), Uint8Array.from([64]), [opening64]));
time("local verify() of the U128 range proof", () => range128.verify());
console.log(`  sizes: equality ${equality.toBytes().length} B, range U64 ${range64.toBytes().length} B, range U128 ${range128.toBytes().length} B`);

// A proof for someone else's key must fail on-chain too.
const otherOpening = new PedersenOpening();
const wrongKey = new CiphertextCommitmentEqualityProofData(other, other.pubkey().encryptU64(1n),
  PedersenCommitment.from(1n, otherOpening), otherOpening, 1n).toBytes();
wrongKey.set(elgamal.pubkey().toBytes(), 0); // claim it is about `elgamal`'s key

// ---- verify on localnet --------------------------------------------------------------------
console.log("\n[ZK ElGamal proof program on localnet, via simulateTransaction]");
const feePayer = b58encode(randomBytes(32));
await rpc("requestAirdrop", [feePayer, 1_000_000_000]);
for (let i = 0; i < 40 && !((await rpc("getBalance", [feePayer, { commitment: "confirmed" }]))?.value > 0); i++) {
  await new Promise((r) => setTimeout(r, 250));
}
await verifyOnChain("pubkey validity", feePayer, IX.PubkeyValidity, pubkeyValidity.toBytes());
await verifyOnChain("ciphertext-commitment equality", feePayer, IX.CiphertextCommitmentEquality, equality.toBytes());
await verifyOnChain("equality, statement swapped", feePayer, IX.CiphertextCommitmentEquality, wrongKey);
await verifyOnChain("range U64", feePayer, IX.RangeU64, range64.toBytes());
await verifyOnChain("range U128", feePayer, IX.RangeU128, range128.toBytes());
