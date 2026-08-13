import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { RequestAuthError, requirePrivyDid } from "@/lib/auth/request";
import { devnetConnection, parseWalletAddress } from "@/lib/wallet/solana-server";
import { isValidAmount } from "@/lib/wallet/domain";
import { recordConfirmedWalletEvent } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userDid = await requirePrivyDid(req);
    const body = await req.json() as {
      walletAddress?: string;
      action?: "allocate" | "withdraw";
      amount?: number;
      signature?: string;
    };
    const owner = parseWalletAddress(body.walletAddress ?? "");
    const mint = new PublicKey(process.env.NEXT_PUBLIC_TEST_USDC_MINT ?? "");
    const programId = new PublicKey(process.env.NEXT_PUBLIC_WHISTL_PROGRAM_ID ?? "");
    if ((body.action !== "allocate" && body.action !== "withdraw") || !body.signature || !isValidAmount(body.amount ?? 0, 1_000_000)) {
      throw new Error("INVALID_WALLET_RECEIPT");
    }

    const transaction = await devnetConnection().getParsedTransaction(body.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!transaction || transaction.meta?.err) throw new Error("UNCONFIRMED_WALLET_RECEIPT");
    const keys = transaction.transaction.message.accountKeys;
    const signedByOwner = keys.some((item) => item.pubkey.equals(owner) && item.signer);
    const calledProgram = transaction.transaction.message.instructions.some((instruction) => instruction.programId.equals(programId));
    if (!signedByOwner || !calledProgram) throw new Error("UNTRUSTED_WALLET_RECEIPT");

    const before = (transaction.meta?.preTokenBalances ?? [])
      .filter((item) => item.owner === owner.toBase58() && item.mint === mint.toBase58())
      .reduce((sum, item) => sum + BigInt(item.uiTokenAmount.amount), BigInt(0));
    const after = (transaction.meta?.postTokenBalances ?? [])
      .filter((item) => item.owner === owner.toBase58() && item.mint === mint.toBase58())
      .reduce((sum, item) => sum + BigInt(item.uiTokenAmount.amount), BigInt(0));
    const expected = BigInt(Math.round((body.amount ?? 0) * 1_000_000));
    const observed = body.action === "allocate" ? before - after : after - before;
    if (observed !== expected) throw new Error("WALLET_RECEIPT_AMOUNT_MISMATCH");

    const event = await recordConfirmedWalletEvent({
      userDid,
      walletAddress: owner.toBase58(),
      actionType: body.action,
      amount: body.amount!,
      tokenMint: mint.toBase58(),
      txSignature: body.signature,
    });
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    const status = error instanceof RequestAuthError ? error.status : 400;
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status });
  }
}
