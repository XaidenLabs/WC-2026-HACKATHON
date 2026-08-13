import assert from "node:assert/strict";
import test from "node:test";
import { chooseOpportunity, forecastsFromQuote, opportunitiesFromQuote, opportunityKey, rankOpportunities, type OraOpportunity } from "./engine-domain.ts";
import type { MarketFixture, MarketQuote } from "../market-data/types.ts";

function opportunity(fixtureId: number, evPct: number, value = true): OraOpportunity {
  return {
    fixtureId,
    match: `Home ${fixtureId} v Away ${fixtureId}`,
    startTime: 1_000 + fixtureId,
    market: "1x2",
    line: null,
    marketLabel: "Match winner",
    selectionLabel: `Home ${fixtureId}`,
    pick: {
      selection: "home",
      prob: 55,
      marketProb: 49,
      edge: 6,
      evPct,
      dec: 2.1,
      value,
      tier: value ? "value" : "pass",
      confidence: value ? "Value edge" : "No edge",
      reasoning: "test",
    },
  };
}

test("highest qualified EV is selected deterministically", () => {
  const selected = chooseOpportunity([opportunity(3, 4.1), opportunity(2, 7), opportunity(1, 6)], 4);
  assert.equal(selected?.fixtureId, 2);
});

test("mandate minimum EV and model pass both fail closed", () => {
  assert.equal(chooseOpportunity([opportunity(1, 3.9)], 4), null);
  assert.equal(chooseOpportunity([opportunity(1, 8, false)], 4), null);
});

test("ranking does not mutate the scanner input", () => {
  const input = [opportunity(1, 4), opportunity(2, 8)];
  const ranked = rankOpportunities(input);
  assert.deepEqual(input.map((item) => item.fixtureId), [1, 2]);
  assert.deepEqual(ranked.map((item) => item.fixtureId), [2, 1]);
});

test("opportunity key deduplicates a fixture and market", () => {
  assert.equal(opportunityKey(opportunity(81, 5)), "ora:v2:81:1x2:na:home");
});

test("forecast layer can select a model-only market without calling it a trade", () => {
  const quality = { hitRatio: 0.71, predictability: "good" as const, predictivePower: "up" as const };
  const fixture: MarketFixture = {
    FixtureId: 91,
    Participant1: "Arsenal",
    Participant2: "Coventry",
    Participant1Id: 1,
    Participant2Id: 2,
    Participant1IsHome: true,
    StartTime: 2_000,
    Ts: 2_000,
    Competition: "Test League",
    CompetitionId: 8,
    FixtureGroupId: 1,
    source: "sportmonks",
  };
  const quote: MarketQuote = {
    fixtureId: 91,
    source: "sportmonks",
    bookmaker: null,
    updatedAt: new Date(0).toISOString(),
    odds: null,
    model: { home: 60, draw: 25, away: 15, source: "sportmonks", quality },
    ou: null,
    goalsModel: null,
    goalModels: [
      { line: 1.5, over: 74.3, under: 25.7, source: "sportmonks", quality },
      { line: 4.5, over: 16.4, under: 83.6, source: "sportmonks", quality },
    ],
    goalMarkets: [],
    btts: null,
    bttsModel: { yes: 52, no: 48, source: "sportmonks", quality },
  };

  const forecasts = forecastsFromQuote(fixture, quote);
  assert.equal(forecasts[0].selectionLabel, "Over 1.5");
  assert.equal(forecasts[0].status, "forecast_only");
  assert.equal(opportunitiesFromQuote(fixture, quote).length, 0);
});
