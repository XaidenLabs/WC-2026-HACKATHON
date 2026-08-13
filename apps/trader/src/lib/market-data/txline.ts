import "server-only";
import type { MarketFixture, MarketQuote, MarketScore } from "@/lib/market-data/types";
import type { TxFixture, TxOddsEntry, TxScoreEvent } from "@/lib/txline/types";
import { getFixtures, getOddsSnapshot, getScoresSnapshot } from "@/lib/txline/server";
import { parse1X2, parseCurrentScore, parseOU } from "@/lib/txline/types";

const MAX_FIXTURE_DAYS = 31;

function epochDay(ms: number): number {
  return Math.floor(ms / 86_400_000);
}

function scoreFromTxline(events: TxScoreEvent[]): MarketScore | undefined {
  const parsed = parseCurrentScore(events);
  if (!parsed) return undefined;
  return {
    home: parsed.p1Goals,
    away: parsed.p2Goals,
    minutes: parsed.minutes,
    isLive: parsed.clockRunning,
    isFinished: parsed.isFinished,
    state: parsed.isFinished ? "Finished" : parsed.clockRunning ? "Live" : "Scheduled",
  };
}

function normalizeFixture(fixture: TxFixture, score?: MarketScore): MarketFixture | null {
  if (!Number.isSafeInteger(fixture.FixtureId) || !Number.isFinite(fixture.StartTime)) return null;
  return {
    FixtureId: fixture.FixtureId,
    Participant1: fixture.Participant1,
    Participant2: fixture.Participant2,
    Participant1Id: fixture.Participant1Id,
    Participant2Id: fixture.Participant2Id,
    Participant1IsHome: true,
    StartTime: fixture.StartTime,
    Ts: fixture.Ts,
    Competition: fixture.Competition,
    CompetitionId: fixture.CompetitionId,
    FixtureGroupId: fixture.FixtureGroupId,
    source: "txline",
    score,
  };
}

export async function getTxlineFixtures(input: { fromMs?: number; toMs?: number; fixtureId?: number } = {}): Promise<MarketFixture[]> {
  const fromMs = input.fromMs ?? Date.now() - 6 * 60 * 60 * 1_000;
  const requestedTo = input.toMs ?? Date.now() + 21 * 86_400_000;
  const toMs = Math.min(requestedTo, fromMs + MAX_FIXTURE_DAYS * 86_400_000);
  const fixtures = await getFixtures({ startEpochDay: epochDay(fromMs) });
  const filtered = fixtures
    .filter((fixture) => input.fixtureId == null || fixture.FixtureId === input.fixtureId)
    .filter((fixture) => fixture.StartTime >= fromMs && fixture.StartTime <= toMs);

  const scored = await Promise.all(filtered.slice(0, 40).map(async (fixture) => {
    try {
      const events = await getScoresSnapshot(fixture.FixtureId) as TxScoreEvent[];
      return normalizeFixture(fixture, scoreFromTxline(events));
    } catch {
      return normalizeFixture(fixture);
    }
  }));

  return scored.filter((fixture): fixture is MarketFixture => fixture != null);
}

export async function getTxlineQuote(fixtureId: number): Promise<MarketQuote> {
  if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) throw new Error("BAD_FIXTURE_ID");
  const odds = await getOddsSnapshot(fixtureId) as TxOddsEntry[];
  const oneXTwo = parse1X2(odds);
  const ou = parseOU(odds);

  return {
    fixtureId,
    source: "txline",
    bookmaker: { id: 0, name: "TXLine market" },
    updatedAt: new Date().toISOString(),
    odds: oneXTwo,
    model: null,
    ou,
    goalsModel: null,
    goalModels: [],
    goalMarkets: [],
    btts: null,
    bttsModel: null,
  };
}
