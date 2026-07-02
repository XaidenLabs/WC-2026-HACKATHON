import "server-only";
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

// ORA inscribes every trading call as a Solana memo (SPL Memo v2) — a public, tamper-proof
// track record. No custom program deploy needed; the memo IS the proof.
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export function devnetConnection(): Connection {
  return new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com", "confirmed");
}

export function oraKeypair(): Keypair {
  const s = process.env.ORA_SECRET_BASE58;
  if (!s) throw new Error("ORA_SECRET_BASE58 not set");
  return Keypair.fromSecretKey(bs58.decode(s));
}

export function oraPubkey(): PublicKey {
  const pk = process.env.NEXT_PUBLIC_ORA_PUBKEY;
  return pk ? new PublicKey(pk) : oraKeypair().publicKey;
}

export function explorerUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

/** Inscribe a memo string on-chain, signed by ORA. Returns the tx signature. */
export async function inscribe(memo: string): Promise<string> {
  const conn = devnetConnection();
  const ora = oraKeypair();
  const ix = new TransactionInstruction({
    keys: [{ pubkey: ora.publicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo.slice(0, 450), "utf8"),
  });
  const tx = new Transaction().add(ix);
  tx.feePayer = ora.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
  return sendAndConfirmTransaction(conn, tx, [ora], { commitment: "confirmed" });
}
