import { NextResponse } from "next/server";
import { getMarketFixtures, getMarketQuote } from "@/lib/market-data/server";
import { coachForecast } from "@/lib/ora/coach";
import { forecastsFromQuote, opportunitiesFromQuote, rankOpportunities } from "@/lib/ora/engine-domain";
import { getSportmonksFixtureContext, SportmonksTokenMissing } from "@/lib/sportmonks/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fixtureId = Number(new URL(request.url).searchParams.get("fixtureId"));
  if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
    return NextResponse.json({ ok: false, error: "BAD_FIXTURE_ID" }, { status: 400 });
  }

  try {
    const fixture = (await getMarketFixtures({ fixtureId }))[0];
    if (!fixture) return NextResponse.json({ ok: false, error: "FIXTURE_NOT_FOUND" }, { status: 404 });
    const [quoteResult, contextResult] = await Promise.allSettled([
      getMarketQuote(fixtureId, fixture.CompetitionId),
      getSportmonksFixtureContext(fixtureId),
    ]);
    if (quoteResult.status === "rejected") throw quoteResult.reason;
    const quote = quoteResult.value;
    const context = contextResult.status === "fulfilled" ? contextResult.value : {
      fixtureId,
      home: { id: fixture.Participant1Id, name: fixture.Participant1 },
      away: { id: fixture.Participant2Id, name: fixture.Participant2 },
      sidelined: [],
      recentFixtures: [],
      headToHead: [],
      limitations: ["Detailed injury, recent-form, and head-to-head records were unavailable from the current Sportmonks plan or response."],
    };
    const forecasts = forecastsFromQuote(fixture, quote);
    const forecast = forecasts[0] ?? null;
    if (!forecast) return NextResponse.json({ ok: false, error: "FORECAST_UNAVAILABLE" }, { status: 409 });
    const trade = rankOpportunities(opportunitiesFromQuote(fixture, quote))[0] ?? null;
    const analysis = await coachForecast(forecast, trade, context);
    return NextResponse.json({ ok: true, forecast, alternatives: forecasts.slice(1, 4), trade, analysis, context });
  } catch (error) {
    if (error instanceof SportmonksTokenMissing) {
      return NextResponse.json({ ok: false, error: "SPORTMONKS_API_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 502 });
  }
}
