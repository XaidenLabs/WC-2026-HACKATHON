import "server-only";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import type { AnchorWalletLike, SettlePactProof } from "./program";
import { getProgram, buildSettlePact } from "./program";

export function devnetConnection(): Connection {
  return new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com", "confirmed");
}

function kpFromEnv(name: string): Keypair {
  const s = process.env[name];
  if (!s) throw new Error(`${name} not set`);
  return Keypair.fromSecretKey(bs58.decode(s));
}
export const oraKeypair = () => kpFromEnv("ORA_SECRET_BASE58");
export const mintAuthorityKeypair = () => kpFromEnv("MINT_AUTHORITY_SECRET_BASE58");

// Minimal provider wallet — we sign explicitly with the Keypair when sending.
export function nodeWallet(kp: Keypair): AnchorWalletLike {
  return {
    publicKey: kp.publicKey,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
}

/** Server-side settle_pact: ORA signs as settler, submits proof, releases escrow. */
export async function settlePactOnChain(p: {
  pactId: bigint;
  creator: PublicKey;
  counterparty: PublicKey;
  proof: SettlePactProof;
}): Promise<string> {
  const conn = devnetConnection();
  const ora = oraKeypair();
  const program = getProgram(conn, nodeWallet(ora));

  const ix = await buildSettlePact(program, { ...p, settler: ora.publicKey });

  const tx = new Transaction().add(ix);
  tx.feePayer = ora.publicKey;
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;

  return sendAndConfirmTransaction(conn, tx, [ora], { commitment: "confirmed" });
}

export async function saveCommentaryOnChain(p: {
  fixtureId: number;
  headline: string;
  analysis: string;
  market: string;
  source: string;
  timestamp: number;
}): Promise<string> {
  const conn = devnetConnection();
  const ora = oraKeypair();
  const program = getProgram(conn, nodeWallet(ora));

  const { buildSaveCommentary } = await import("./program");
  const ix = await buildSaveCommentary(program, { ...p, author: ora.publicKey });

  const tx = new Transaction().add(ix);
  tx.feePayer = ora.publicKey;
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;

  return sendAndConfirmTransaction(conn, tx, [ora], { commitment: "confirmed" });
}
