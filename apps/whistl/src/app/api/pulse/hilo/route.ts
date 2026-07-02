import { NextResponse } from "next/server";
import { getFixtures, getScoresSnapshot, TxlineTokenMissing } from "@/lib/txline/server";
import { parseCurrentScore, type TxFixture, type TxScoreEvent } from "@/lib/txline/types";
import { matchPhase } from "@/lib/pulse/format";

export type HiLoMatch = {
  fixtureId: number;
  p1: string;
  p2: string;
  competition: string;
  startTime: number;
  goals: number;
  corners: number;
  cards: number;
};

// GET /api/pulse/hilo — ordered list of finished World Cup matches with their final
// stat totals, used by the Hi-Lo game. Reuses the shared TxLINE server client.
export async function GET() {
  try {
    // Reach back 2 weeks so there's a deep enough sequence to play.
    const startEpochDay = Math.floor(Date.now() / 86_400_000) - 14;
    const fixtures = (await getFixtures({ startEpochDay })) as TxFixture[];
    const now = Date.now();

    const candidates = fixtures
      .filter((f) => matchPhase(f.StartTime, now) === "finished")
      .sort((a, b) => a.StartTime - b.StartTime)
      .slice(-16); // most recent 16, kept in chronological order

    const settled = await Promise.all(
      candidates.map(async (f): Promise<HiLoMatch | null> => {
        try {
          const events = (await getScoresSnapshot(f.FixtureId)) as TxScoreEvent[];
          const parsed = parseCurrentScore(events);
          if (!parsed) return null;
          const reds = (parsed.stats["5"] ?? 0) + (parsed.stats["6"] ?? 0);
          return {
            fixtureId: f.FixtureId,
            p1: f.Participant1,
            p2: f.Participant2,
            competition: f.Competition,
            startTime: f.StartTime,
            goals: parsed.p1Goals + parsed.p2Goals,
            corners: parsed.p1Corners + parsed.p2Corners,
            cards: parsed.p1Yellow + parsed.p2Yellow + reds,
          };
        } catch {
          return null;
        }
      }),
    );

    const matches = settled.filter((m): m is HiLoMatch => m !== null);
    return NextResponse.json({ ok: true, matches });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
