import type { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

/**
 * Anything that can sign transactions: the same shape as Anchor's `Wallet` and the Solana wallet
 * adapters, so either can be passed directly.
 */
export interface ZeroWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

/** Wraps a Keypair as a ZeroWallet (scripts, tests, server-side agents). */
export function keypairWallet(keypair: Keypair): ZeroWallet {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if ("version" in tx) tx.sign([keypair]);
    else tx.partialSign(keypair);
    return tx;
  };
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => sign(tx),
    signAllTransactions: async (txs) => txs.map(sign),
  };
}
