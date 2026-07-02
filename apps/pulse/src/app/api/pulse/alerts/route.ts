import { NextResponse } from "next/server";
import { getFixtures, TxlineTokenMissing } from "@/lib/txline/server";
import { type TxFixture } from "@/lib/txline/types";
import { matchPhase } from "@/lib/pulse/format";
import { detectSharpMoves, type SharpAlert } from "@/lib/pulse/sharp";

const MIN = 60 * 1000;
const HR = 60 * MIN;
// Sample several points and keep the biggest swing — catches sudden moves a single diff misses.
const LIVE_SAMPLES = [10 * MIN, 30 * MIN, 90 * MIN];
const PREMATCH_SAMPLES = [3 * HR, 9 * HR, 24 * HR];
const MAX_SCAN = 8;

// GET /api/pulse/alerts — scans live + upcoming WC markets for significant odds movement
// (sharp money). Pure TxLINE odds comparison via the `asOf` snapshot. Finished matches are
// skipped — TxLINE drops their odds feed once the match ends.
export async function GET() {
  try {
    const fixtures = (await getFixtures({
      startEpochDay: Math.floor(Date.now() / 86_400_000) - 14,
    })) as TxFixture[];
    const now = Date.now();

    const live = fixtures.filter((f) => matchPhase(f.StartTime, now) === "live");
    const upcoming = fixtures
      .filter((f) => matchPhase(f.StartTime, now) === "upcoming")
      .sort((a, b) => a.StartTime - b.StartTime); // soonest kickoffs first — most active money

    // Live markets first (real-time moves), then the soonest upcoming, capped for latency.
    const scan = [...live, ...upcoming].slice(0, MAX_SCAN);

    const batches = await Promise.all(
      scan.map(async (f) => {
        const isLive = matchPhase(f.StartTime, now) === "live";
        const samples = (isLive ? LIVE_SAMPLES : PREMATCH_SAMPLES).map((dt) => now - dt);
        try {
          return await detectSharpMoves({
            fixtureId: f.FixtureId,
            p1: f.Participant1,
            p2: f.Participant2,
            competition: f.Competition,
            phase: isLive ? "live" : "upcoming",
            asOfList: samples,
          });
        } catch {
          return [] as SharpAlert[];
        }
      }),
    );

    const moves = batches.flat().sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));

    // Real alerts cross the notable/sharp threshold; everything else is "quiet" drift we
    // still surface as biggest-movers so the screen is never empty during flat markets.
    const alerts = moves.filter((m) => m.severity !== "minor").slice(0, 12);
    const movers = moves.filter((m) => m.severity === "minor").slice(0, 6);

    return NextResponse.json({
      ok: true,
      alerts,
      movers,
      quiet: alerts.length === 0,
      watching: scan.length,
    });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
