import "server-only";
import { getFixtures, getScoresSnapshot } from "@/lib/txline/server";
import { parseCurrentScore, type TxFixture, type TxScoreEvent } from "@/lib/txline/types";
import { matchPhase } from "@/lib/pulse/format";

// Tournament-wide data derived from TxLINE: the team pool (for sweepstake assignment) and
// live standings (for the leaderboard). Both cached briefly in module memory.

export type TeamStanding = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  points: number; // Win 3 · Draw 1 · each goal scored 1
  live: boolean; // currently has a match in progress
};

const WIDE_LOOKBACK_DAYS = 21;

function wideFixtures(): Promise<TxFixture[]> {
  return getFixtures({
    startEpochDay: Math.floor(Date.now() / 86_400_000) - WIDE_LOOKBACK_DAYS,
  }) as Promise<TxFixture[]>;
}

// ── Team pool ─────────────────────────────────────────────────────────────────
let poolCache: { at: number; teams: string[] } | null = null;

export async function getTeamPool(): Promise<string[]> {
  if (poolCache && Date.now() - poolCache.at < 5 * 60_000) return poolCache.teams;
  const fixtures = await wideFixtures();
  const teams = [...new Set(fixtures.flatMap((f) => [f.Participant1, f.Participant2]))].sort();
  poolCache = { at: Date.now(), teams };
  return teams;
}

// ── Standings ─────────────────────────────────────────────────────────────────
let standingsCache: { at: number; map: Record<string, TeamStanding> } | null = null;
const MAX_SCORE_FETCHES = 28;

function blank(team: string): TeamStanding {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, points: 0, live: false };
}

export async function computeAllStandings(): Promise<Record<string, TeamStanding>> {
  if (standingsCache && Date.now() - standingsCache.at < 60_000) return standingsCache.map;

  const fixtures = await wideFixtures();
  const now = Date.now();
  // Matches that have started (live or finished), most recent first, capped for latency.
  const played = fixtures
    .filter((f) => matchPhase(f.StartTime, now) !== "upcoming")
    .sort((a, b) => b.StartTime - a.StartTime)
    .slice(0, MAX_SCORE_FETCHES);

  const map: Record<string, TeamStanding> = {};
  const bump = (team: string) => (map[team] ??= blank(team));

  await Promise.all(
    played.map(async (f) => {
      let parsed;
      try {
        parsed = parseCurrentScore((await getScoresSnapshot(f.FixtureId)) as TxScoreEvent[]);
      } catch {
        return;
      }
      if (!parsed) return;

      const { p1Goals, p2Goals, isFinished } = parsed;
      const a = bump(f.Participant1);
      const b = bump(f.Participant2);

      if (isFinished) {
        a.played++; b.played++;
        a.goalsFor += p1Goals; b.goalsFor += p2Goals;
        a.points += p1Goals; b.points += p2Goals; // goal points
        if (p1Goals > p2Goals) { a.won++; a.points += 3; b.lost++; }
        else if (p2Goals > p1Goals) { b.won++; b.points += 3; a.lost++; }
        else { a.drawn++; b.drawn++; a.points += 1; b.points += 1; }
      } else {
        // In progress — provisional goal points, no result yet.
        a.live = b.live = true;
        a.goalsFor += p1Goals; b.goalsFor += p2Goals;
        a.points += p1Goals; b.points += p2Goals;
      }
    }),
  );

  standingsCache = { at: Date.now(), map };
  return map;
}
