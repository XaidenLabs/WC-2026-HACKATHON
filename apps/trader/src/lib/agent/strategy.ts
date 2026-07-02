// The executable strategy spec that ACE compiles natural language into, plus a pure
// evaluator + backtest math. Kept framework-free so it runs on server and client.

export type Selection = "home" | "draw" | "away";
export type Side = "back" | "lay";

export type TriggerType =
  | "prob_below" // selection implied prob < value(%)  → underdog / value backing
  | "prob_above" // selection implied prob > value(%)  → favourite backing
  | "odds_drop" // selection prob ROSE ≥ value(pp) over window → money coming in
  | "odds_rise" // selection prob FELL ≥ value(pp) over window → drifting out
  | "always"; // enter every qualifying match (baseline)

export type StrategySpec = {
  name: string;
  market: "1X2";
  selection: Selection;
  side: Side;
  trigger: { type: TriggerType; value: number; windowMin?: number };
  stake: number; // units per bet
  summary: string; // plain-English restatement
};

// Everything the evaluator needs about a single match.
export type MatchInput = {
  fixtureId: number;
  match: string;
  entryDec: number; // decimal odds of the selection at entry
  entryProb: number; // implied % of the selection at entry
  probChange: number | null; // pp change over the window (+ = shortened / money in)
  result: Selection | null; // actual outcome, null if unknown
};

export type Trade = {
  fixtureId: number;
  match: string;
  selection: Selection;
  side: Side;
  entryDec: number;
  stake: number;
  won: boolean;
  pnl: number; // units
  note: string;
};

const SEL_LABEL: Record<Selection, string> = { home: "Home", draw: "Draw", away: "Away" };

export function triggerFires(spec: StrategySpec, m: MatchInput): boolean {
  const t = spec.trigger;
  switch (t.type) {
    case "always":
      return true;
    case "prob_below":
      return m.entryProb < t.value;
    case "prob_above":
      return m.entryProb > t.value;
    case "odds_drop":
      return m.probChange != null && m.probChange >= t.value;
    case "odds_rise":
      return m.probChange != null && m.probChange <= -t.value;
    default:
      return false;
  }
}

/** Evaluate one match. Returns a settled Trade, or null if it didn't trigger / can't settle. */
export function evaluateMatch(spec: StrategySpec, m: MatchInput): Trade | null {
  if (m.result == null || !Number.isFinite(m.entryDec) || m.entryDec <= 1) return null;
  if (!triggerFires(spec, m)) return null;

  const selectionWon = m.result === spec.selection;
  const dec = m.entryDec;

  // Back: win → stake·(dec−1), lose → −stake.  Lay: mirror (bet against the selection).
  let pnl: number;
  let won: boolean;
  if (spec.side === "back") {
    won = selectionWon;
    pnl = selectionWon ? spec.stake * (dec - 1) : -spec.stake;
  } else {
    won = !selectionWon;
    pnl = selectionWon ? -spec.stake * (dec - 1) : spec.stake;
  }

  return {
    fixtureId: m.fixtureId,
    match: m.match,
    selection: spec.selection,
    side: spec.side,
    entryDec: dec,
    stake: spec.stake,
    won,
    pnl: Math.round(pnl * 100) / 100,
    note: `${spec.side} ${SEL_LABEL[spec.selection]} @ ${dec.toFixed(2)} → ${SEL_LABEL[m.result]} (${won ? "win" : "loss"})`,
  };
}

export type BacktestSummary = {
  trades: Trade[];
  count: number;
  wins: number;
  winRate: number; // 0..1
  staked: number;
  pnl: number;
  roi: number; // pnl / staked
  equity: { i: number; pnl: number }[]; // cumulative curve
};

export function summarize(trades: Trade[]): BacktestSummary {
  let pnl = 0;
  const equity: { i: number; pnl: number }[] = [{ i: 0, pnl: 0 }];
  trades.forEach((t, i) => {
    pnl += t.pnl;
    equity.push({ i: i + 1, pnl: Math.round(pnl * 100) / 100 });
  });
  const wins = trades.filter((t) => t.won).length;
  const staked = trades.reduce((s, t) => s + t.stake, 0);
  return {
    trades,
    count: trades.length,
    wins,
    winRate: trades.length ? wins / trades.length : 0,
    staked: Math.round(staked * 100) / 100,
    pnl: Math.round(pnl * 100) / 100,
    roi: staked ? Math.round((pnl / staked) * 1000) / 1000 : 0,
    equity,
  };
}
