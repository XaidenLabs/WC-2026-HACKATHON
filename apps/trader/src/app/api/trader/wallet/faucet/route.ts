import { NextResponse } from "next/server";
import { RequestAuthError, requirePrivyDid } from "@/lib/auth/request";
import { createWalletReview, DAILY_FAUCET_LIMIT } from "@/lib/wallet/domain";
import { mintTestUsdc, parseWalletAddress } from "@/lib/wallet/solana-server";
import { completeWalletEvent, reserveDailyFaucet } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

type FaucetRequest = { walletAddress?: string; amount?: number; confirmation?: string };

export async function POST(req: Request) {
  let eventId: string | null = null;
  try {
    const did = await requirePrivyDid(req);
    const body = await req.json() as FaucetRequest;
    if (body.confirmation !== "GET_TEST_USDC_DEVNET") throw new Error("EXPLICIT_DEVNET_CONFIRMATION_REQUIRED");
    const walletAddress = parseWalletAddress(body.walletAddress ?? "").toBase58();
    const amount = Number(body.amount);
    createWalletReview({ action: "faucet", amount, destination: walletAddress });
    if (amount > DAILY_FAUCET_LIMIT) throw new Error("DAILY_FAUCET_LIMIT_EXCEEDED");

    const mint = process.env.NEXT_PUBLIC_TEST_USDC_MINT;
    if (!mint) throw new Error("DEVNET_FAUCET_NOT_CONFIGURED");
    const day = new Date().toISOString().slice(0, 10);
    const reservation = await reserveDailyFaucet({ userDid: did, walletAddress, amount, tokenMint: mint, day });
    eventId = reservation.event.id;
    if (!reservation.created) {
      if (reservation.event.status === "confirmed") {
        return NextResponse.json({ ok: true, alreadyCompleted: true, signature: reservation.event.txSignature });
      }
      throw new Error(reservation.event.status === "pending" ? "FAUCET_REQUEST_IN_PROGRESS" : "DAILY_FAUCET_ALREADY_ATTEMPTED");
    }

    const result = await mintTestUsdc(walletAddress, amount);
    await completeWalletEvent(eventId, "confirmed", { txSignature: result.signature });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (eventId) {
      try { await completeWalletEvent(eventId, "failed", { errorCode: (error as Error).message.slice(0, 120) }); } catch { /* preserve the original failure */ }
    }
    const status = error instanceof RequestAuthError ? error.status : 400;
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status });
  }
}
