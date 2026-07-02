import { NextResponse } from "next/server";
import { getFixtures, TxlineTokenMissing } from "@/lib/txline/server";

// Live fixtures proxy. Holds the TxLINE token server-side; the browser calls this.
// Not cached (route handlers are dynamic by default), so data is always live.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startEpochDay = searchParams.get("startEpochDay");
  const competitionId = searchParams.get("competitionId");

  try {
    const { getScoresSnapshot } = await import("@/lib/txline/server");
    const { parseCurrentScore } = await import("@/lib/txline/types");
    
    let fixtures = await getFixtures({
      startEpochDay: startEpochDay ? Number(startEpochDay) : undefined,
      competitionId: competitionId ? Number(competitionId) : undefined,
    });
    
    // Fetch live scores concurrently
    const fixturesWithScores = await Promise.all(fixtures.map(async (f) => {
      try {
        const events = await getScoresSnapshot(f.FixtureId);
        const score = parseCurrentScore(events as any[]);
        return { ...f, score };
      } catch (e) {
        return f; // fallback if score fetch fails
      }
    }));
    
    return NextResponse.json({ ok: true, source: "live", fixtures: fixturesWithScores });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
        return NextResponse.json(
        { ok: false, error: "TXLINE_TOKEN_MISSING" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 },
    );
  }
}
