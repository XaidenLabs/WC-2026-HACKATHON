import "server-only";
import { getOddsSnapshot } from "@/lib/txline/server";
import { parse1X2, parseOU, type TxOddsEntry } from "@/lib/txline/types";

// Sharp-money detection: compare the current odds snapshot against several earlier `asOf`
// snapshots and keep the biggest demargined-% swing per market. Sampling multiple points
// catches mid-window moves a single two-point diff would miss. Pure TxLINE data — no
// stateful tracking, no external services.

export type Severity = "sharp" | "notable" | "minor";

export type SharpAlert = {
  fixtureId: number;
  match: string;
  competition?: string;
  market: string; // "Match winner" | "Total goals 2.5"
  outcome: string; // "Netherlands", "Over 2.5"
  fromPct: number;
  toPct: number;
  shift: number; // signed percentage points (toPct - fromPct)
  direction: "in" | "out"; // "in" = shortening (more likely); "out" = drifting
  severity: Severity;
  elapsedMin: number | null;
  phase: "live" | "upcoming";
  headline: string;
};

export const SHARP_PP = 2; // ≥2pp swing = sharp money (lowered for demo)
export const NOTABLE_PP = 1; // ≥1pp swing = notable move
const NOISE_PP = 0.1; // ignore sub-0.1pp jitter

type OddsWithTs = TxOddsEntry & { Ts?: number };
type Candidate = { outcome: string; from: number | null; to: number | null };
type Move = { market: string; outcome: string; from: number; to: number };

function latestTs(odds: TxOddsEntry[]): number | null {
  const ts = (odds as OddsWithTs[]).map((o) => o.Ts).filter((t): t is number => typeof t === "number");
  return ts.length ? Math.max(...ts) : null;
}

function severityOf(absShift: number): Severity {
  if (absShift >= SHARP_PP) return "sharp";
  if (absShift >= NOTABLE_PP) return "notable";
  return "minor";
}

// Biggest-magnitude legitimate move among a market's correlated outcomes.
function pickBest(cands: Candidate[]): { outcome: string; from: number; to: number } | null {
  let best: { outcome: string; from: number; to: number } | null = null;
  for (const c of cands) {
    if (c.from == null || c.to == null) continue;
    if (Math.abs(c.to - c.from) < NOISE_PP) continue;
    if (!best || Math.abs(c.to - c.from) > Math.abs(best.to - best.from)) {
      best = { outcome: c.outcome, from: c.from, to: c.to };
    }
  }
  return best;
}

function marketMoves(prev: TxOddsEntry[], cur: TxOddsEntry[], p1: string, p2: string): Move[] {
  const moves: Move[] = [];

  const x1 = parse1X2(cur);
  const x0 = parse1X2(prev);
  if (x1 && x0) {
    const best = pickBest([
      { outcome: p1, from: x0.home.pct, to: x1.home.pct },
      { outcome: "the draw", from: x0.draw.pct, to: x1.draw.pct },
      { outcome: p2, from: x0.away.pct, to: x1.away.pct },
    ]);
    if (best) moves.push({ market: "Match winner", ...best });
  }

  const o1 = parseOU(cur);
  const o0 = parseOU(prev);
  if (o1 && o0 && o1.line === o0.line) {
    const best = pickBest([
      { outcome: `Over ${o1.line}`, from: o0.over.pct, to: o1.over.pct },
      { outcome: `Under ${o1.line}`, from: o0.under.pct, to: o1.under.pct },
    ]);
    if (best) moves.push({ market: `Total goals ${o1.line}`, ...best });
  }

  return moves;
}

export async function detectSharpMoves(args: {
  fixtureId: number;
  p1: string;
  p2: string;
  competition?: string;
  phase: "live" | "upcoming";
  asOfList: number[];
}): Promise<SharpAlert[]> {
  const { fixtureId, p1, p2, competition, phase, asOfList } = args;

  const cur = (await getOddsSnapshot(fixtureId)) as TxOddsEntry[];
  const curTs = latestTs(cur);

  const hist = (
    await Promise.all(
      asOfList.map((ms) =>
        getOddsSnapshot(fixtureId, ms)
          .then((o) => ({ o: o as TxOddsEntry[], ts: latestTs(o as TxOddsEntry[]) }))
          .catch(() => null),
      ),
    )
  ).filter((h): h is { o: TxOddsEntry[]; ts: number | null } => h !== null);

  // Keep the biggest swing per market across all sampled points.
  const bestByMarket = new Map<string, { move: Move; prevTs: number | null }>();
  for (const h of hist) {
    for (const mv of marketMoves(h.o, cur, p1, p2)) {
      const existing = bestByMarket.get(mv.market);
      const mag = Math.abs(mv.to - mv.from);
      if (!existing || mag > Math.abs(existing.move.to - existing.move.from)) {
        bestByMarket.set(mv.market, { move: mv, prevTs: h.ts });
      }
    }
  }

  const alerts: SharpAlert[] = [];
  for (const { move, prevTs } of bestByMarket.values()) {
    const shift = Math.round((move.to - move.from) * 10) / 10;
    const direction: SharpAlert["direction"] = shift > 0 ? "in" : "out";
    alerts.push({
      fixtureId,
      match: `${p1} v ${p2}`,
      competition,
      market: move.market,
      outcome: move.outcome,
      fromPct: Math.round(move.from),
      toPct: Math.round(move.to),
      shift,
      direction,
      severity: severityOf(Math.abs(shift)),
      elapsedMin: curTs != null && prevTs != null ? Math.round((curTs - prevTs) / 60_000) : null,
      phase,
      headline:
        direction === "in"
          ? `Money coming in on ${move.outcome}`
          : `Market drifting off ${move.outcome}`,
    });
  }
  return alerts;
}
