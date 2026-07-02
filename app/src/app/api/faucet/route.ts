import { NextResponse } from "next/server";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { verifyPrivyToken, privyConfigured } from "@/lib/auth/privy-server";
import { devnetConnection, mintAuthorityKeypair } from "@/lib/whistl/server";
import { TEST_USDC_MINT } from "@/lib/whistl/program";

const FAUCET_AMOUNT = 500; // test-USDC per claim

// Mint test-USDC to an authenticated user's wallet so they can stake a pact.
export async function POST(req: Request) {
  if (!privyConfigured()) {
    return NextResponse.json({ ok: false, error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  }
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "NO_TOKEN" }, { status: 401 });
  try {
    await verifyPrivyToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  let owner: PublicKey;
  try {
    owner = new PublicKey(body?.wallet);
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_WALLET" }, { status: 400 });
  }

  try {
    const conn = devnetConnection();
    const authority = mintAuthorityKeypair();
    // Embedded wallets start with 0 SOL — give a little for rent + fees so create_pact can run.
    if ((await conn.getBalance(owner)) < 0.03 * LAMPORTS_PER_SOL) {
      const fund = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: owner,
          lamports: Math.round(0.1 * LAMPORTS_PER_SOL),
        }),
      );
      fund.feePayer = authority.publicKey;
      fund.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
      await sendAndConfirmTransaction(conn, fund, [authority]);
    }
    const ata = await getOrCreateAssociatedTokenAccount(conn, authority, TEST_USDC_MINT, owner);
    const sig = await mintTo(conn, authority, TEST_USDC_MINT, ata.address, authority, FAUCET_AMOUNT * 1_000_000);
    return NextResponse.json({ ok: true, amount: FAUCET_AMOUNT, sig, ata: ata.address.toBase58() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
