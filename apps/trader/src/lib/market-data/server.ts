import "server-only";
import { getSportmonksFixtures, getSportmonksQuote } from "@/lib/sportmonks/server";
import { getTxlineFixtures, getTxlineQuote } from "@/lib/market-data/txline";
import type { MarketDataSource, MarketFixture, MarketQuote } from "@/lib/market-data/types";

const VALID_SOURCES = new Set<MarketDataSource>(["txline", "sportmonks", "hybrid"]);

function configuredSource(): MarketDataSource {
  const value = process.env.MARKET_DATA_PROVIDER?.trim().toLowerCase() as MarketDataSource | undefined;
  return value && VALID_SOURCES.has(value) ? value : "hybrid";
}

export function marketDataSource(): MarketDataSource {
  return configuredSource();
}

export const MARKET_DATA_SOURCE = configuredSource();

export async function getMarketFixtures(input: { fromMs?: number; toMs?: number; fixtureId?: number } = {}) {
  const source = configuredSource();
  if (source === "txline") return getTxlineFixtures(input);
  if (source === "sportmonks") return getSportmonksFixtures(input);

  const [txline, sportmonks] = await Promise.allSettled([
    getTxlineFixtures(input),
    getSportmonksFixtures(input),
  ]);
  const merged = new Map<string, MarketFixture>();
  if (txline.status === "fulfilled") {
    for (const fixture of txline.value) merged.set(`txline:${fixture.FixtureId}`, fixture);
  }
  if (sportmonks.status === "fulfilled") {
    for (const fixture of sportmonks.value) merged.set(`sportmonks:${fixture.FixtureId}`, fixture);
  }
  if (merged.size) {
    return [...merged.values()].toSorted((a, b) => a.StartTime - b.StartTime || a.FixtureId - b.FixtureId);
  }
  if (txline.status === "rejected") throw txline.reason;
  if (sportmonks.status === "rejected") throw sportmonks.reason;
  return [];
}

export async function getMarketQuote(fixtureId: number, leagueId?: number) {
  const source = configuredSource();
  if (source === "txline") return getTxlineQuote(fixtureId);
  if (source === "sportmonks") return getSportmonksQuote(fixtureId, leagueId);

  const txlineQuote = await getTxlineQuote(fixtureId).catch(() => null);
  if (txlineQuote) return txlineQuote satisfies MarketQuote;
  return getSportmonksQuote(fixtureId, leagueId);
}
