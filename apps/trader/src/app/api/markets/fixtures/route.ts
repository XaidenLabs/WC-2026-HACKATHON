import { NextResponse } from "next/server";
import { getMarketFixtures, marketDataSource } from "@/lib/market-data/server";
import { isFootballScope, MARKET_SCOPE } from "@/lib/product/scope";
import { SportmonksTokenMissing } from "@/lib/sportmonks/server";
import { TxlineTokenMissing } from "@/lib/txline/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (!isFootballScope(searchParams.get("sport"))) {
    return NextResponse.json({ ok: false, error: "FOOTBALL_ONLY" }, { status: 400 });
  }
  const fixtureId = searchParams.get("fixtureId");
  const fromMs = searchParams.get("fromMs");
  const toMs = searchParams.get("toMs");
  try {
    const fixtures = await getMarketFixtures({
      fixtureId: fixtureId ? Number(fixtureId) : undefined,
      fromMs: fromMs ? Number(fromMs) : undefined,
      toMs: toMs ? Number(toMs) : undefined,
    });
    return NextResponse.json({ ok: true, source: marketDataSource(), sport: MARKET_SCOPE.sport, fixtures });
  } catch (error) {
    if (error instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_API_TOKEN_MISSING" }, { status: 503 });
    }
    if (error instanceof SportmonksTokenMissing) {
      return NextResponse.json({ ok: false, error: "SPORTMONKS_API_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 502 });
  }
}
