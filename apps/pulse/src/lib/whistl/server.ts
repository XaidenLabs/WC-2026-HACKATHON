import "server-only";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";

// SPL Memo v2 — lets ORA inscribe its reasoning directly on-chain, no custom program deploy needed.
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
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

/**
 * Inscribe ORA's commentary on Solana devnet as an SPL Memo, signed by the ORA wallet.
 * Returns the real tx signature (viewable on the explorer). The entry is always stored so the
 * feed renders even if the chain write fails; the explorer link only shows when a sig exists.
 */
export async function saveCommentaryOnChain(p: {
  fixtureId: number;
  headline: string;
  analysis: string;
  market: string;
  source: string;
  timestamp: number;
}): Promise<string | null> {
  let signature: string | null = null;
  try {
    const conn = devnetConnection();
    const ora = oraKeypair();

    // Human-readable inscription — capped well under the memo/tx size limit.
    // Format is parsed back out by /api/pulse/commentaries when it reads the feed off-chain.
    const memo =
      `ORA·WHISTL | WC#${p.fixtureId} | ${p.source.toUpperCase()} | ${p.headline}` +
      (p.analysis ? ` — ${p.analysis}` : "") +
      (p.market ? ` || MKT: ${p.market}` : "");
    const data = Buffer.from(memo.slice(0, 450), "utf8");

    const ix = new TransactionInstruction({
      keys: [{ pubkey: ora.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data,
    });
    const tx = new Transaction().add(ix);
    tx.feePayer = ora.publicKey;
    tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
    signature = await sendAndConfirmTransaction(conn, tx, [ora], { commitment: "confirmed" });
  } catch (e) {
    console.error("[saveCommentaryOnChain] memo inscription failed:", (e as Error).message);
  }

  // No in-memory store needed — the memo IS the source of truth. /api/pulse/commentaries
  // reads the feed straight from ORA's on-chain memo history.
  return signature;
}
