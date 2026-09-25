import { PublicKey } from "@solana/web3.js";
import { IDL } from "./idl/idl.js";

/** Clusters the SDK knows a `zero_policy` deployment for. Mainnet is deliberately absent. */
export type ZeroCluster = "localnet" | "devnet";

export interface ClusterConfig {
  /** Default public RPC endpoint. Use your own RPC provider for anything beyond testing. */
  rpcUrl: string;
  programId: PublicKey;
  /** Query-string suffix for explorer.solana.com links, e.g. `?cluster=devnet`. */
  explorerSuffix: string;
}

/** The same program ID is deployed on every cluster listed here. */
const PROGRAM_ID = new PublicKey(IDL.address);

export const CLUSTERS: Readonly<Record<ZeroCluster, ClusterConfig>> = {
  localnet: {
    rpcUrl: "http://127.0.0.1:8899",
    programId: PROGRAM_ID,
    explorerSuffix: `?cluster=custom&customUrl=${encodeURIComponent("http://127.0.0.1:8899")}`,
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    programId: PROGRAM_ID,
    explorerSuffix: "?cluster=devnet",
  },
};

/** An explorer.solana.com link to a transaction signature or an account address. */
export function explorerUrl(
  target: string | PublicKey,
  cluster: ZeroCluster,
  kind: "tx" | "address" = typeof target === "string" && target.length > 50 ? "tx" : "address",
): string {
  const id = typeof target === "string" ? target : target.toBase58();
  return `https://explorer.solana.com/${kind}/${id}${CLUSTERS[cluster].explorerSuffix}`;
}
