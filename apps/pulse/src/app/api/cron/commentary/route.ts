import { NextResponse } from "next/server";
import { getFixtures } from "@/lib/txline/server";
import type { TxFixture } from "@/lib/txline/types";

export async function GET(req: Request) {
  // For Vercel Cron, you typically verify the authorization header:
  // if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new Response("Unauthorized", { status: 401 });
  // }

  try {
    const fixtures = (await getFixtures({
      startEpochDay: Math.floor(Date.now() / 86_400_000) - 1, // Cover matches that started late yesterday
    })) as TxFixture[];
    
    // Find all matches that are likely live (started < 2.5h ago and in the past)
    const now = Date.now();
    const liveFixtures = fixtures.filter(f => {
      const started = f.StartTime < now;
      const notTooOld = now - f.StartTime < 2.5 * 60 * 60 * 1000;
      return started && notTooOld;
    });

    let count = 0;
    // We construct the absolute URL for the fetch using the incoming request's origin
    const url = new URL("/api/pulse/commentary", req.url).toString();

    // Generate commentary sequentially to avoid rate limits on LLM or RPC
    for (const f of liveFixtures) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fixtureId: f.FixtureId,
            p1: f.Participant1,
            p2: f.Participant2,
            competition: f.Competition,
          }),
        });
        if (res.ok) count++;
      } catch (err) {
        console.error(`[cron] Failed for fixture ${f.FixtureId}:`, err);
      }
    }

    return NextResponse.json({ ok: true, generated: count, totalLive: liveFixtures.length });
  } catch (err) {
    console.error("[cron/commentary]", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
