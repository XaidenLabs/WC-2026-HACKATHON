"use client";

import { useWallets, useSignTransaction } from "@privy-io/react-auth/solana";
import { usePrivy } from "@privy-io/react-auth";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  getProgram,
  buildCreatePact,
  pactPda,
  toBaseUnits,
  TEST_USDC_MINT,
  USDC_DECIMALS,
  type PactTermsArgs,
  type AnchorWalletLike,
} from "./program";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

function readOnlyWallet(pk: PublicKey): AnchorWalletLike {
  return { publicKey: pk, signTransaction: async <T>(t: T) => t, signAllTransactions: async <T>(t: T[]) => t };
}

/**
 * Sign a transaction with Privy, then send it via RPC ourselves.
 * This bypasses Privy's signAndSendTransaction which has an internal
 * "connect" step that throws "Failed to connect to wallet" on embedded wallets.
 */
async function signAndSend(
  signTransaction: ReturnType<typeof useSignTransaction>["signTransaction"],
  wallet: NonNullable<ReturnType<typeof useWallets>["wallets"]>[number],
  tx: Transaction,
  conn: Connection,
): Promise<string> {
  const serialized = tx.serialize({ requireAllSignatures: false });

  // Step 1: Privy signs the transaction (no "connect" step needed here)
  const { signedTransaction } = await signTransaction({
    transaction: serialized,
    wallet,
    chain: "solana:devnet",
  });

  // Step 2: We send the raw signed bytes ourselves via RPC
  const sig = await conn.sendRawTransaction(signedTransaction, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  // Step 3: Confirm the transaction
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

  return sig;
}

/** Client-side WHISTL actions: faucet test-USDC + create a pact signed by the Privy wallet. */
export function useWhistlActions() {
  const { wallets } = useWallets();
  const { getAccessToken } = usePrivy();
  const { signTransaction } = useSignTransaction();

  // Prefer the Privy embedded wallet; external wallets (Phantom etc.) may not be
  // connected through Privy's signing flow and will throw "Failed to connect to wallet".
  const wallet =
    wallets?.find((w) => (w.standardWallet as { isPrivyWallet?: boolean })?.isPrivyWallet) ??
    wallets?.[0];

  async function faucet(): Promise<{ ok: boolean; error?: string }> {
    if (!wallet) return { ok: false, error: "Connect a Solana wallet first" };
    const token = await getAccessToken();
    const r = await fetch("/api/faucet", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ wallet: wallet.address }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true } : { ok: false, error: j?.error || `HTTP ${r.status}` };
  }

  async function createPact(args: {
    pactId: bigint;
    fixtureId: number;
    stakeUsdc: number;
    terms: PactTermsArgs;
  }): Promise<{ pactPda: string }> {
    if (!wallet) throw new Error("Connect a Solana wallet first");

    const creator = new PublicKey(wallet.address);
    const conn = new Connection(RPC, "confirmed");
    
    // Preflight Check: Verify USDC ATA exists and has enough balance
    const creatorAta = getAssociatedTokenAddressSync(TEST_USDC_MINT, creator);
    try {
      const balanceInfo = await conn.getTokenAccountBalance(creatorAta);
      const balance = balanceInfo.value.uiAmount ?? 0;
      if (balance < args.stakeUsdc) {
        throw new Error(`Insufficient USDC balance. You have ${balance} USDC, need ${args.stakeUsdc} USDC. Please use the faucet.`);
      }
    } catch (e) {
      // Re-throw if it's our own balance error
      if (e instanceof Error && e.message.includes("USDC")) throw e;
      throw new Error("No USDC token account found. Please use the faucet to get test tokens.");
    }

    const program = getProgram(conn, readOnlyWallet(creator));

    const ix = await buildCreatePact(program, {
      pactId: args.pactId,
      fixtureId: args.fixtureId,
      stakeBaseUnits: toBaseUnits(args.stakeUsdc),
      terms: args.terms,
      creator,
    });

    const ataIx = createAssociatedTokenAccountIdempotentInstruction(
      creator, creatorAta, creator, TEST_USDC_MINT
    );

    const { blockhash } = await conn.getLatestBlockhash("confirmed");
    
    const tx = new Transaction({
      feePayer: creator,
      recentBlockhash: blockhash,
    }).add(ataIx, ix);

    try {
      await signAndSend(signTransaction, wallet, tx, conn);
    } catch (e) {
      console.error("[whistl] sign+send failed:", (e as Error)?.message, e);
      throw new Error((e as Error)?.message || "Transaction failed to send");
    }

    // Wait for the pact account to land on-chain before ORA accepts.
    const pda = pactPda(args.pactId);
    for (let i = 0; i < 24; i++) {
      if (await conn.getAccountInfo(pda)) return { pactPda: pda.toBase58() };
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error("create_pact didn't confirm in time");
  }

  /** Transfer test-USDC to any Solana address, creating recipient ATA if needed. */
  async function transferUsdc(args: {
    toAddress: string;
    amount: number;
    fromAddress: string;
  }): Promise<{ sig: string }> {
    if (!wallet) throw new Error("Connect a wallet first");

    const conn = new Connection(RPC, "confirmed");
    const sender = new PublicKey(args.fromAddress);
    const recipient = new PublicKey(args.toAddress);
    const amountBaseUnits = BigInt(Math.round(args.amount * 10 ** USDC_DECIMALS));

    const senderAta = getAssociatedTokenAddressSync(TEST_USDC_MINT, sender);
    const recipientAta = getAssociatedTokenAddressSync(TEST_USDC_MINT, recipient);

    const { blockhash } = await conn.getLatestBlockhash("confirmed");
    
    const tx = new Transaction({
      feePayer: sender,
      recentBlockhash: blockhash,
    }).add(
      // Creates recipient ATA if absent (noop + no extra cost if it already exists).
      createAssociatedTokenAccountIdempotentInstruction(
        sender, recipientAta, recipient, TEST_USDC_MINT,
      ),
      createTransferInstruction(senderAta, recipientAta, sender, amountBaseUnits)
    );

    const sig = await signAndSend(signTransaction, wallet, tx, conn);
    return { sig };
  }

  return { wallet, faucet, createPact, transferUsdc };
}

