import { NextResponse } from "next/server";
import { RequestAuthError, requirePrivyDid } from "@/lib/auth/request";
import { readDevnetWallet } from "@/lib/wallet/solana-server";
import { listWalletEvents } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const did = await requirePrivyDid(req);
    const address = new URL(req.url).searchParams.get("address") ?? "";
    const [wallet, events] = await Promise.all([
      readDevnetWallet(address),
      listWalletEvents(did),
    ]);
    return NextResponse.json({ ok: true, wallet, events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof RequestAuthError ? error.status : 400;
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status });
  }
}
