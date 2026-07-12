// TxLINE response types (verified against https://txline-docs.txodds.com, June 2026).
// Odds shape confirmed live from /api/odds/snapshot/{fixtureId} (June 2026).

export interface TxOddsEntry {
  FixtureId: number;
  SuperOddsType:
    | "1X2_PARTICIPANT_RESULT"
    | "ASIANHANDICAP_PARTICIPANT_GOALS"
    | "OVERUNDER_PARTICIPANT_GOALS"
    | string;
  InRunning: boolean;
  MarketParameters: string | null; // e.g. "line=0", "line=2.5"
  MarketPeriod: string | null;     // null = full match, "half=1" = first half
  PriceNames: string[];            // ["part1","draw","part2"] or ["part1","part2"] or ["over","under"]
  Prices: number[];                // decimal odds × 1000 (e.g. 3517 = 3.517)
  Pct: string[];                   // demargined implied % e.g. "28.433", or "NA"
}

/** Parse the 1X2 market (full match preferred, half=1 fallback). */
export function parse1X2(odds: TxOddsEntry[]) {
  const full = odds.find(
    (o) =>
      o.SuperOddsType === "1X2_PARTICIPANT_RESULT" &&
      o.MarketPeriod == null &&
      o.PriceNames.length === 3,
  );
  const half = odds.find(
    (o) =>
      o.SuperOddsType === "1X2_PARTICIPANT_RESULT" &&
      o.MarketPeriod === "half=1" &&
      o.PriceNames.length === 3,
  );
  const m = full ?? half;
  if (!m) return null;
  const pct = m.Pct.map((s) => parseFloat(s));
  return {
    home: { dec: m.Prices[0] / 1000, pct: isNaN(pct[0]) ? null : pct[0] },
    draw: { dec: m.Prices[1] / 1000, pct: isNaN(pct[1]) ? null : pct[1] },
    away: { dec: m.Prices[2] / 1000, pct: isNaN(pct[2]) ? null : pct[2] },
    isLive: m.InRunning,
    isHalf: m.MarketPeriod === "half=1",
  };
}

/** Parse the Asian Handicap line=0 market (effectively home vs away win probability). */
export function parseAH0(odds: TxOddsEntry[]) {
  const m = odds.find(
    (o) =>
      o.SuperOddsType === "ASIANHANDICAP_PARTICIPANT_GOALS" &&
      o.MarketParameters === "line=0" &&
      o.MarketPeriod == null,
  );
  if (!m) return null;
  const pct = m.Pct.map((s) => parseFloat(s));
  return {
    home: { dec: m.Prices[0] / 1000, pct: isNaN(pct[0]) ? null : pct[0] },
    away: { dec: m.Prices[1] / 1000, pct: isNaN(pct[1]) ? null : pct[1] },
    isLive: m.InRunning,
  };
}

/** Parse best available O/U goals market. */
export function parseOU(odds: TxOddsEntry[]) {
  // Prefer the most "standard" line — try common lines in order of preference
  const LINES = ["2.5", "1.5", "3.5", "0.5", "4.5"];
  for (const line of LINES) {
    const m = odds.find(
      (o) =>
        o.SuperOddsType === "OVERUNDER_PARTICIPANT_GOALS" &&
        o.MarketParameters === `line=${line}` &&
        o.MarketPeriod == null,
    );
    if (m) {
      const pct = m.Pct.map((s) => parseFloat(s));
      return {
        line,
        over:  { dec: m.Prices[0] / 1000, pct: isNaN(pct[0]) ? null : pct[0] },
        under: { dec: m.Prices[1] / 1000, pct: isNaN(pct[1]) ? null : pct[1] },
        isLive: m.InRunning,
      };
    }
  }
  // Fall back to any available O/U
  const m = odds.find(
    (o) => o.SuperOddsType === "OVERUNDER_PARTICIPANT_GOALS" && o.MarketPeriod == null,
  );
  if (!m) return null;
  const line = m.MarketParameters?.replace("line=", "") ?? "?";
  const pct = m.Pct.map((s) => parseFloat(s));
  return {
    line,
    over:  { dec: m.Prices[0] / 1000, pct: isNaN(pct[0]) ? null : pct[0] },
    under: { dec: m.Prices[1] / 1000, pct: isNaN(pct[1]) ? null : pct[1] },
    isLive: m.InRunning,
  };
}

export interface TxFixture {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  Participant1Id: number;
  Participant2Id: number;
  Participant1IsHome: boolean;
  StartTime: number; // unix milliseconds (kickoff) · same unit as TxScoreEvent.StartTime
  Ts: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
}

export interface ScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface ScoresBatchSummary {
  fixtureId: number;
  updateStats: { updateCount: number; minTimestamp: number; maxTimestamp: number };
  eventStatsSubTreeRoot: string;
}

// GET /api/scores/stat-validation response (maps onto the on-chain validate_stat args).
export interface StatValidation {
  ts: number;
  statToProve: ScoreStat;
  statToProve2?: ScoreStat;
  eventStatRoot: string;
  summary: ScoresBatchSummary;
  statProof: ProofNode[];
  statProof2?: ProofNode[];
  subTreeProof: ProofNode[];
  mainTreeProof: ProofNode[];
}

// Score event returned by /api/scores/snapshot/{fixtureId} and /api/scores/historical/{fixtureId}
// Stats keys: base 1-8 for full match; (period*1000)+base for period-specific.
export interface TxScoreEvent {
  FixtureId: number;
  GameState: string | null;
  StartTime: number; // ms
  StatusId: number;
  Seq: number;
  Ts: number;
  Clock: { Running: boolean; Seconds: number } | null;
  Score: {
    Participant1: {
      H1?: { Goals?: number; YellowCards?: number; RedCards?: number; Corners?: number };
      H2?: { Goals?: number; YellowCards?: number; RedCards?: number; Corners?: number };
      HT?: { Goals?: number; YellowCards?: number; RedCards?: number; Corners?: number };
      Total?: { Goals?: number; YellowCards?: number; RedCards?: number; Corners?: number };
    };
    Participant2: {
      H1?: { Goals?: number; YellowCards?: number; RedCards?: number; Corners?: number };
      H2?: { Goals?: number; YellowCards?: number; RedCards?: number; Corners?: number };
      HT?: { Goals?: number; YellowCards?: number; RedCards?: number; Corners?: number };
      Total?: { Goals?: number; YellowCards?: number; RedCards?: number; Corners?: number };
    };
  } | null;
  // Stats[key] where key = (period*1000)+base_key. period 0 = full match (base key only).
  // base_key: 1/2 goals, 3/4 yellow, 5/6 red, 7/8 corners (P1/P2).
  Stats: Record<string, number> | null;
}

/** Parse the most recent live match state from a scores snapshot array.
 *  Uses the event with the highest Seq that has Score data.
 *  Returns null if no score data exists at all.
 */
export function parseCurrentScore(events: TxScoreEvent[]) {
  if (!events.length) return null;
  // Find the most recent event that actually has Score data
  const withScore = events.filter(
    (e) => e.Score?.Participant1?.Total || e.Score?.Participant2?.Total,
  );
  if (!withScore.length) return null;
  const latest = withScore.reduce((a, b) => (b.Seq > a.Seq ? b : a));
  const p1Total = latest.Score?.Participant1?.Total;
  const p2Total = latest.Score?.Participant2?.Total;
  const clockRunning = latest.Clock?.Running ?? false;
  // StatusId 100 = TxLINE terminal 'match finished'. Codes 1-10 are in-play, incl. half-time,
  // extra-time and penalty BREAKS (clock stops but the match is NOT over) — never infer finished from a stopped clock.
  const isFinished = latest.StatusId != null && latest.StatusId >= 100;
  return {
    p1Goals: p1Total?.Goals ?? 0,
    p2Goals: p2Total?.Goals ?? 0,
    p1Corners: p1Total?.Corners ?? 0,
    p2Corners: p2Total?.Corners ?? 0,
    p1Yellow: p1Total?.YellowCards ?? 0,
    p2Yellow: p2Total?.YellowCards ?? 0,
    minutes: Math.floor((latest.Clock?.Seconds ?? 0) / 60),
    clockRunning,
    isFinished,
    statusId: latest.StatusId,
    stats: latest.Stats ?? {},
  };
}

export interface ProofNode {
  hash: string;
  isRightSibling: boolean;
}

// Soccer stat keys (TxLINE soccer-feed). Period 0 = full match.
export const SOCCER_STAT = {
  P1_GOALS: 1, P2_GOALS: 2,
  P1_YELLOW: 3, P2_YELLOW: 4,
  P1_RED: 5, P2_RED: 6,
  P1_CORNERS: 7, P2_CORNERS: 8,
} as const;
