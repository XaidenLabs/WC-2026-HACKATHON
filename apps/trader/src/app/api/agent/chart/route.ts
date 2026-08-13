import { NextResponse } from "next/server";
import { getMarketFixtures, getMarketQuote } from "@/lib/market-data/server";
import { SportmonksTokenMissing } from "@/lib/sportmonks/server";

type Sel = "home" | "draw" | "away";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fixtureId = Number(url.searchParams.get("fixtureId"));
  const requestedSelection = url.searchParams.get("sel");
  const selection: Sel = requestedSelection === "draw" || requestedSelection === "away" ? requestedSelection : "home";
  if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
    return NextResponse.json({ ok: false, error: "BAD_FIXTURE_ID" }, { status: 400 });
  }

  try {
    const [fixture, quote] = await Promise.all([
      getMarketFixtures({ fixtureId }).then((fixtures) => fixtures[0]),
      getMarketQuote(fixtureId),
    ]);
    if (!fixture || !quote.odds) return NextResponse.json({ ok: false, error: "MARKET_UNAVAILABLE" }, { status: 404 });
    const leg = quote.odds[selection];
    return NextResponse.json({
      ok: true,
      source: quote.source,
      candles: [],
      p1: fixture.Participant1,
      p2: fixture.Participant2,
      competition: fixture.Competition,
      startTime: fixture.StartTime,
      current: leg.pct == null ? null : { prob: Math.round(leg.pct * 10) / 10, dec: leg.dec },
      changePct: null,
      bookmaker: quote.bookmaker,
      updatedAt: quote.updatedAt,
    });
  } catch (error) {
    if (error instanceof SportmonksTokenMissing) {
      return NextResponse.json({ ok: false, error: "SPORTMONKS_API_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 502 });
  }
}
