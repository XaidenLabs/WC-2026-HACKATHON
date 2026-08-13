import { NextResponse } from "next/server";
import { getMarketFixtures, getMarketQuote, marketDataSource } from "@/lib/market-data/server";
import { SportmonksTokenMissing } from "@/lib/sportmonks/server";
import { TxlineTokenMissing } from "@/lib/txline/server";
import { forecastsFromQuote, opportunitiesFromQuote, rankOpportunities } from "@/lib/ora/engine-domain";

// GET /api/ora/picks — the home feed. Live/upcoming matches, each with ORA's recommended pick
// derived from provider predictions and coherent bookmaker quotes.

const MAX = 10;
type FeedBody = { ok: true; source: string; picks: unknown[] };
let feedCache: { freshUntil: number; staleUntil: number; body: FeedBody } | null = null;

export async function GET() {
  if (feedCache && feedCache.freshUntil > Date.now()) return NextResponse.json(feedCache.body);
  try {
    const now = Date.now();
    const fixtures = await getMarketFixtures({ fromMs: now - 2.5 * 3600e3, toMs: now + 21 * 86_400_000 });
    const LIVE_MS = 2.5 * 3600e3;

    const tradeable = fixtures
      .map((f) => ({ f, phase: (now < f.StartTime ? "upcoming" : now < f.StartTime + LIVE_MS ? "live" : "finished") as "upcoming" | "live" | "finished" }))
      .filter((x) => x.phase !== "finished")
      .sort((a, b) => Number(b.phase === "live") - Number(a.phase === "live") || a.f.StartTime - b.f.StartTime)
      .slice(0, MAX);

    const batches: Array<Awaited<ReturnType<typeof priceFixture>>> = [];
    for (let index = 0; index < tradeable.length; index += 3) {
      batches.push(...await Promise.all(tradeable.slice(index, index + 3).map(priceFixture)));
    }
    const picks = batches.filter((x): x is NonNullable<typeof x> => x !== null)
      .toSorted((a, b) => Number(Boolean(b.trade)) - Number(Boolean(a.trade)) || (b.trade?.pick.evPct ?? 0) - (a.trade?.pick.evPct ?? 0) || a.startTime - b.startTime)
      .slice(0, 24);

    const body: FeedBody = { ok: true, source: marketDataSource(), picks };
    feedCache = { freshUntil: Date.now() + 30_000, staleUntil: Date.now() + 10 * 60_000, body };
    return NextResponse.json(body);

    async function priceFixture({ f, phase }: (typeof tradeable)[number]) {
        try {
          const quote = await getMarketQuote(f.FixtureId, f.CompetitionId);
          const forecasts = forecastsFromQuote(f, quote);
          const forecast = forecasts[0];
          if (!forecast) return null;
          const trade = rankOpportunities(opportunitiesFromQuote(f, quote))[0] ?? null;
          return {
            fixtureId: f.FixtureId,
            p1: f.Participant1,
            p2: f.Participant2,
            competition: f.Competition,
            startTime: f.StartTime,
            phase,
            forecast,
            alternatives: forecasts.slice(1, 4),
            trade,
          };
        } catch {
          return null;
        }
    }
  } catch (e) {
    if (feedCache && feedCache.staleUntil > Date.now()) return NextResponse.json(feedCache.body);
    if (e instanceof TxlineTokenMissing) return NextResponse.json({ ok: false, error: "TXLINE_API_TOKEN_MISSING" }, { status: 503 });
    if (e instanceof SportmonksTokenMissing) return NextResponse.json({ ok: false, error: "SPORTMONKS_API_TOKEN_MISSING" }, { status: 503 });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
