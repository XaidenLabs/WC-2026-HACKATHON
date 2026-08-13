import "server-only";
import { getMarketFixtures, getMarketQuote } from "@/lib/market-data/server";
import type { TradingMandate } from "@/lib/supervision/domain";
import { chooseOpportunity, opportunitiesFromQuote, type OraOpportunity } from "./engine-domain";

const MAX_FIXTURES_PER_SCAN = 12;
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1_000;

export type OraScanFailure = {
  fixtureId: number;
  code: "ODDS_UNAVAILABLE" | "MARKET_INVALID";
};

export type OraScanResult = {
  scannedAt: string;
  fixturesFound: number;
  fixturesPriced: number;
  qualified: number;
  opportunity: OraOpportunity | null;
  failures: OraScanFailure[];
};

export async function scanOraMarkets(mandate: TradingMandate, nowMs = Date.now()): Promise<OraScanResult> {
  if (mandate.killed) throw new Error("KILL_SWITCH");
  if (mandate.paused) throw new Error("ORA_PAUSED");
  if (mandate.allowedMarkets.length === 0) throw new Error("NO_ALLOWED_ORA_MARKET");

  const fixtures = await getMarketFixtures({ fromMs: nowMs - LIVE_WINDOW_MS, toMs: nowMs + 21 * 86_400_000 });
  const tradeable = fixtures
    .filter((fixture) => Number.isFinite(fixture.FixtureId)
      && Number.isFinite(fixture.StartTime)
      && fixture.StartTime > nowMs - LIVE_WINDOW_MS)
    .toSorted((a, b) => a.StartTime - b.StartTime || a.FixtureId - b.FixtureId)
    .slice(0, MAX_FIXTURES_PER_SCAN);

  const failures: OraScanFailure[] = [];
  const priced = await Promise.all(tradeable.map(async (fixture): Promise<OraOpportunity[]> => {
    try {
      const quote = await getMarketQuote(fixture.FixtureId, fixture.CompetitionId);
      const opportunities = opportunitiesFromQuote(fixture, quote)
        .filter((opportunity) => mandate.allowedMarkets.includes(opportunity.market));
      if (!opportunities.length) {
        failures.push({ fixtureId: fixture.FixtureId, code: "MARKET_INVALID" });
        return [];
      }
      return opportunities;
    } catch {
      failures.push({ fixtureId: fixture.FixtureId, code: "ODDS_UNAVAILABLE" });
      return [];
    }
  }));

  const opportunities = priced.flat();
  const qualified = opportunities.filter((item) => item.pick.value && item.pick.evPct >= mandate.minEvPct);
  return {
    scannedAt: new Date(nowMs).toISOString(),
    fixturesFound: tradeable.length,
    fixturesPriced: priced.filter((items) => items.length > 0).length,
    qualified: qualified.length,
    opportunity: chooseOpportunity(opportunities, mandate.minEvPct),
    failures,
  };
}

export async function freshOraQuote(fixtureId: number, market: OraOpportunity["market"], line: number | null) {
  const fixtures = await getMarketFixtures({ fixtureId });
  const fixture = fixtures[0];
  if (!fixture) throw new Error("FRESH_FIXTURE_UNAVAILABLE");
  const quote = await getMarketQuote(fixtureId, fixture.CompetitionId);
  const opportunity = opportunitiesFromQuote(fixture, quote).find((item) => item.market === market
    && (item.line === line || (item.line != null && line != null && Math.abs(item.line - line) <= 0.001)));
  if (!opportunity) throw new Error("FRESH_MARKET_UNAVAILABLE");
  return opportunity;
}
