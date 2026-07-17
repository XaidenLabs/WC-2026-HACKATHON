import { NextResponse } from "next/server";
import { getFixtures, getOddsSnapshot, TxlineTokenMissing } from "@/lib/txline/server";
import { parse1X2, type TxFixture, type TxOddsEntry } from "@/lib/txline/types";
import { triggerFires, type MatchInput, type Selection, type StrategySpec } from "@/lib/agent/strategy";
import { formatCall, reasoningFor, type AgentCall } from "@/lib/agent/call";
import { inscribe, explorerUrl } from "@/lib/agent/onchain";

// POST /api/agent/deploy  { spec }
// Evaluates the strategy against LIVE + UPCOMING markets and takes the agent's best positions
// right now. It only inscribes calls that meet the compiled rule — a near match is never
// represented as a signal.

const MAX_SCAN = 12;
const MAX_INSCRIBE = 3;

function selLeg(x: ReturnType<typeof parse1X2>, sel: Selection) {
  if (!x) return null;
  const leg = sel === "home" ? x.home : sel === "away" ? x.away : x.draw;
  return leg.pct != null && leg.dec ? { prob: leg.pct, dec: leg.dec } : null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const spec = body?.spec as StrategySpec | undefined;
  const onlyFixtureId = Number(body?.fixtureId) || null; // scope ORA to a single match
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
      .filter((f) => onlyFixtureId == null || f.FixtureId === onlyFixtureId)
      .sort((a, b) => a.StartTime - b.StartTime)
      .slice(0, MAX_SCAN);

    // Evaluate every market we can price.
    const evaluated: { f: TxFixture; input: MatchInput; triggered: boolean }[] = [];
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
          evaluated.push({ f, input, triggered: triggerFires(spec, input) });
        } catch {
          /* skip market on odds error */
        }
      }),
    );

    const picks = evaluated.filter((e) => e.triggered).slice(0, MAX_INSCRIBE);

    const calls: (AgentCall & {
      fixtureId: number; entryProb: number; triggered: boolean; signature: string; explorerUrl: string;
    })[] = [];
    for (const { f, input, triggered } of picks) {
      const reasoning = reasoningFor(spec, input);
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
      fired: picks.length,
      inscribed: calls.length,
      bestFit: false,
      calls,
    });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
