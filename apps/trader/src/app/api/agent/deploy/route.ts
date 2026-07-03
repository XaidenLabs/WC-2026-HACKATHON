import { NextResponse } from "next/server";
import { getFixtures, getOddsSnapshot, TxlineTokenMissing } from "@/lib/txline/server";
import { parse1X2, type TxFixture, type TxOddsEntry } from "@/lib/txline/types";
import { triggerFires, type MatchInput, type Selection, type StrategySpec } from "@/lib/agent/strategy";
import { formatCall, reasoningFor, type AgentCall } from "@/lib/agent/call";
import { inscribe, explorerUrl } from "@/lib/agent/onchain";

// POST /api/agent/deploy  { spec }
// Evaluates the strategy against LIVE + UPCOMING markets and takes the agent's best positions
// right now — ranking every market by how well it fits the strategy, then inscribing the top
// few on Solana. Always produces calls when markets are open (strict trigger hits rank first,
// otherwise the closest-fitting markets), so deploying always does something.

const MAX_SCAN = 12;
const MAX_INSCRIBE = 3;

function selLeg(x: ReturnType<typeof parse1X2>, sel: Selection) {
  if (!x) return null;
  const leg = sel === "home" ? x.home : sel === "away" ? x.away : x.draw;
  return leg.pct != null && leg.dec ? { prob: leg.pct, dec: leg.dec } : null;
}

// How well a market fits the strategy's intent (higher = better pick).
function fitScore(spec: StrategySpec, m: MatchInput): number {
  switch (spec.trigger.type) {
    case "prob_above":
      return m.entryProb; // favourite → higher implied % is a better fit
    case "prob_below":
      return 100 - m.entryProb; // underdog → lower implied % is a better fit
    case "odds_drop":
      return m.probChange ?? -999; // money coming in → biggest positive move
    case "odds_rise":
      return -(m.probChange ?? 999); // drifting → biggest negative move
    default:
      return m.entryProb;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const spec = body?.spec as StrategySpec | undefined;
  if (!spec?.selection || !spec?.trigger) {
    return NextResponse.json({ ok: false, error: "Missing strategy spec" }, { status: 400 });
  }
  const windowMs = (spec.trigger.windowMin ?? 30) * 60_000;
  const needsMovement = spec.trigger.type === "odds_drop" || spec.trigger.type === "odds_rise";

  try {
    const fixtures = (await getFixtures({
      startEpochDay: Math.floor(Date.now() / 86_400_000) - 2,
    })) as TxFixture[];
    const now = Date.now();

    const candidates = fixtures
      .filter((f) => now < f.StartTime + 2.5 * 3600 * 1000)
      .sort((a, b) => a.StartTime - b.StartTime)
      .slice(0, MAX_SCAN);

    // Evaluate every market we can price.
    const evaluated: { f: TxFixture; input: MatchInput; triggered: boolean; fit: number }[] = [];
    await Promise.all(
      candidates.map(async (f) => {
        try {
          const late = selLeg(parse1X2((await getOddsSnapshot(f.FixtureId)) as TxOddsEntry[]), spec.selection);
          if (!late) return;
          let probChange: number | null = null;
          if (needsMovement) {
            const early = selLeg(parse1X2((await getOddsSnapshot(f.FixtureId, now - windowMs)) as TxOddsEntry[]), spec.selection);
            probChange = early ? Math.round((late.prob - early.prob) * 10) / 10 : null;
          }
          const input: MatchInput = {
            fixtureId: f.FixtureId,
            match: `${f.Participant1} v ${f.Participant2}`,
            entryDec: late.dec,
            entryProb: late.prob,
            probChange,
            result: null,
          };
          evaluated.push({ f, input, triggered: triggerFires(spec, input), fit: fitScore(spec, input) });
        } catch {
          /* skip market on odds error */
        }
      }),
    );

    // Strict signals rank first; otherwise the best-fitting markets. Always take the top few.
    evaluated.sort((a, b) => Number(b.triggered) - Number(a.triggered) || b.fit - a.fit);
    const strictCount = evaluated.filter((e) => e.triggered).length;
    const picks = evaluated.slice(0, MAX_INSCRIBE);

    const calls: (AgentCall & {
      fixtureId: number; entryProb: number; triggered: boolean; signature: string; explorerUrl: string;
    })[] = [];
    const SEL_LABEL: Record<Selection, string> = { home: "Home", draw: "the Draw", away: "Away" };
    for (const { f, input, triggered } of picks) {
      const reasoning = triggered
        ? reasoningFor(spec, input)
        : `Best available fit for "${spec.name}" — ${SEL_LABEL[spec.selection]} at ${Math.round(input.entryProb)}% (no market met the strict rule).`;
      const call: AgentCall = {
        strategy: spec.name,
        match: input.match,
        side: spec.side,
        selection: spec.selection,
        odds: input.entryDec,
        reasoning,
        fixtureId: f.FixtureId,
      };
      try {
        const signature = await inscribe(formatCall(call));
        calls.push({
          ...call, fixtureId: f.FixtureId, entryProb: Math.round(input.entryProb),
          triggered, signature, explorerUrl: explorerUrl(signature),
        });
      } catch (e) {
        console.error("[deploy] inscribe failed:", (e as Error).message);
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: candidates.length,
      priced: evaluated.length,
      fired: strictCount, // strict signals
      inscribed: calls.length,
      bestFit: strictCount === 0 && calls.length > 0, // took closest-fit picks
      calls,
    });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
