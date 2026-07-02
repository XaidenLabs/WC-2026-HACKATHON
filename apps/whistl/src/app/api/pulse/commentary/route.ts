import { NextResponse } from "next/server";
import {
  getScoresSnapshot,
  getOddsSnapshot,
  getFixtures,
  TxlineTokenMissing,
} from "@/lib/txline/server";
import {
  parse1X2,
  parseCurrentScore,
  type TxFixture,
  type TxScoreEvent,
  type TxOddsEntry,
} from "@/lib/txline/types";
import { matchPhase } from "@/lib/pulse/format";
import { generateCommentary, type MatchContext } from "@/lib/pulse/commentary";

// POST /api/pulse/commentary
// Body: { fixtureId, p1?, p2?, competition? }
// Returns an AI pundit card for the match's current state (real LLM via ACE, template fallback).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const fixtureId = Number(body?.fixtureId);
  if (!Number.isFinite(fixtureId)) {
    return NextResponse.json({ ok: false, error: "BAD_FIXTURE_ID" }, { status: 400 });
  }

  try {
    // Resolve team names + kickoff time. Prefer values from the caller; fall back to fixtures.
    let p1: string | undefined = body?.p1;
    let p2: string | undefined = body?.p2;
    let competition: string | undefined = body?.competition;
    let startTime: number | undefined;

    if (!p1 || !p2 || startTime == null) {
      const fixtures = (await getFixtures({
        startEpochDay: Math.floor(Date.now() / 86_400_000) - 14,
      })) as TxFixture[];
      const fx = fixtures.find((f) => f.FixtureId === fixtureId);
      if (fx) {
        p1 = p1 ?? fx.Participant1;
        p2 = p2 ?? fx.Participant2;
        competition = competition ?? fx.Competition;
        startTime = fx.StartTime;
      }
    }

    const events = (await getScoresSnapshot(fixtureId)) as TxScoreEvent[];
    const parsed = parseCurrentScore(events);

    // Phase: prefer kickoff time; otherwise infer from the score clock.
    const phase: MatchContext["phase"] =
      startTime != null
        ? matchPhase(startTime)
        : parsed?.isFinished
          ? "finished"
          : parsed?.clockRunning
            ? "live"
            : "upcoming";

    // Odds context (best-effort).
    let odds: MatchContext["odds"] = null;
    try {
      const oddsRaw = (await getOddsSnapshot(fixtureId)) as TxOddsEntry[];
      const x = parse1X2(oddsRaw);
      if (x) odds = { homePct: x.home.pct, drawPct: x.draw.pct, awayPct: x.away.pct };
    } catch {
      /* odds optional */
    }

    const ctx: MatchContext = {
      p1: p1 ?? "Home",
      p2: p2 ?? "Away",
      competition,
      phase,
      minute: parsed?.minutes,
      p1Goals: parsed?.p1Goals ?? 0,
      p2Goals: parsed?.p2Goals ?? 0,
      p1Corners: parsed?.p1Corners ?? 0,
      p2Corners: parsed?.p2Corners ?? 0,
      odds,
    };

    const card = await generateCommentary(ctx);

    // If ACE generated a valid card, try to save it on-chain in the background.
    if (card.source === "ace") {
      try {
        const { saveCommentaryOnChain } = await import("@/lib/whistl/server");
        await saveCommentaryOnChain({
          fixtureId,
          headline: card.headline,
          analysis: card.analysis,
          market: card.market,
          source: card.source,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("[commentary] Failed to save on-chain:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      card,
      score: {
        p1Goals: ctx.p1Goals,
        p2Goals: ctx.p2Goals,
        p1Corners: ctx.p1Corners,
        p2Corners: ctx.p2Corners,
        minute: ctx.minute ?? null,
        phase,
      },
      p1: ctx.p1,
      p2: ctx.p2,
      competition,
    });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
