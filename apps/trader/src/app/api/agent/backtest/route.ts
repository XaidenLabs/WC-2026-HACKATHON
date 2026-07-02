import { NextResponse } from "next/server";
import { getFixtures, getOddsSnapshot, getScoresSnapshot, TxlineTokenMissing } from "@/lib/txline/server";
import {
  parse1X2,
  parseCurrentScore,
  type TxFixture,
  type TxOddsEntry,
  type TxScoreEvent,
} from "@/lib/txline/types";
import { evaluateMatch, summarize, type MatchInput, type Selection, type StrategySpec } from "@/lib/agent/strategy";

// POST /api/agent/backtest  { spec }  →  { summary, matchesScanned }
// Replays the strategy over real finished World Cup matches. Entry odds + movement come from
// TxLINE's `asOf` odds snapshots (pre-match + windowed); results come from the final score.
// Every data point is TxLINE-served and Merkle-verifiable — a provably-fair backtest.

const MAX_MATCHES = 14;

function resultOf(p1Goals: number, p2Goals: number): Selection {
  if (p1Goals > p2Goals) return "home";
  if (p2Goals > p1Goals) return "away";
  return "draw";
}

function selProb(x: ReturnType<typeof parse1X2>, sel: Selection) {
  if (!x) return null;
  const leg = sel === "home" ? x.home : sel === "away" ? x.away : x.draw;
  return leg.pct != null && leg.dec ? { prob: leg.pct, dec: leg.dec } : null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const spec = body?.spec as StrategySpec | undefined;
  if (!spec?.selection || !spec?.trigger) {
    return NextResponse.json({ ok: false, error: "Missing strategy spec" }, { status: 400 });
  }
  const windowMs = (spec.trigger.windowMin ?? 30) * 60_000;

  try {
    const fixtures = (await getFixtures({
      startEpochDay: Math.floor(Date.now() / 86_400_000) - 21,
    })) as TxFixture[];
    const now = Date.now();

    const finished = fixtures
      .filter((f) => now > f.StartTime + 2.5 * 3600 * 1000)
      .sort((a, b) => b.StartTime - a.StartTime)
      .slice(0, MAX_MATCHES);

    const inputs = await Promise.all(
      finished.map(async (f): Promise<MatchInput | null> => {
        try {
          const [scores, earlyOdds, lateOdds] = await Promise.all([
            getScoresSnapshot(f.FixtureId) as Promise<TxScoreEvent[]>,
            getOddsSnapshot(f.FixtureId, f.StartTime) as Promise<TxOddsEntry[]>, // pre-match
            getOddsSnapshot(f.FixtureId, f.StartTime + windowMs) as Promise<TxOddsEntry[]>, // after window
          ]);

          const parsed = parseCurrentScore(scores);
          if (!parsed) return null;
          const result = resultOf(parsed.p1Goals, parsed.p2Goals);

          const early = selProb(parse1X2(earlyOdds), spec.selection);
          const late = selProb(parse1X2(lateOdds), spec.selection);
          if (!early && !late) return null;

          const movement = spec.trigger.type === "odds_drop" || spec.trigger.type === "odds_rise";
          const entry = movement ? (late ?? early)! : (early ?? late)!;
          const probChange = early && late ? Math.round((late.prob - early.prob) * 10) / 10 : null;

          return {
            fixtureId: f.FixtureId,
            match: `${f.Participant1} v ${f.Participant2}`,
            entryDec: entry.dec,
            entryProb: entry.prob,
            probChange,
            result,
          };
        } catch {
          return null;
        }
      }),
    );

    const valid = inputs.filter((m): m is MatchInput => m !== null);
    const trades = valid.map((m) => evaluateMatch(spec, m)).filter((t): t is NonNullable<typeof t> => t !== null);

    return NextResponse.json({
      ok: true,
      summary: summarize(trades),
      matchesScanned: valid.length,
    });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
