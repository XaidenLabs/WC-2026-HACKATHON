import { NextResponse } from "next/server";
import { getMarketQuote } from "@/lib/market-data/server";
import { SportmonksTokenMissing } from "@/lib/sportmonks/server";
import { TxlineTokenMissing } from "@/lib/txline/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fixtureId = Number(new URL(request.url).searchParams.get("fixtureId"));
  if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
    return NextResponse.json({ ok: false, error: "BAD_FIXTURE_ID" }, { status: 400 });
  }
  try {
    const quote = await getMarketQuote(fixtureId);
    return NextResponse.json({ ok: true, ...quote });
  } catch (error) {
    if (error instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_API_TOKEN_MISSING" }, { status: 503 });
    }
    if (error instanceof SportmonksTokenMissing) {
      return NextResponse.json({ ok: false, error: "SPORTMONKS_API_TOKEN_MISSING" }, { status: 503 });
    }
    const message = (error as Error).message;
    const status = message.includes("UNAVAILABLE") || message.includes("STALE") ? 409 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
