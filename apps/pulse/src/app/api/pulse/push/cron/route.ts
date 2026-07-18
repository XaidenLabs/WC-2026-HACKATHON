import { NextResponse } from "next/server";
import webpush from "web-push";
import { getFixtures, getScoresSnapshot } from "@/lib/txline/server";
import { parseCurrentScore } from "@/lib/txline/types";
import { getAllSubscriptions } from "@/lib/pulse/push-store";

// Global cache to track previous goal tallies across cron runs
export const goalCache: Record<number, { p1: number; p2: number; finishedSummarySent?: boolean }> = globalThis.goalCache || {};
globalThis.goalCache = goalCache;

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.NEXT_PRIVATE_VAPID_PRIVATE_KEY;
// Guard: setVapidDetails throws if the keys are missing, which would crash the route on import.
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails("mailto:contact@whistl.io", VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function GET() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ ok: false, error: "VAPID keys not configured" }, { status: 503 });
  }
  try {
    const subs = getAllSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ ok: true, msg: "No subscriptions" });
    }

    // getFixtures() returns the fixtures array directly (not an object).
    const fixtures = await getFixtures();
    const liveFixtures = fixtures.filter(f => {
      // Very basic live check: started less than 2.5 hours ago
      const now = Date.now();
      return f.StartTime < now && (now - f.StartTime) < 2.5 * 3600 * 1000;
    });

    for (const f of liveFixtures) {
      const events = await getScoresSnapshot(f.FixtureId);
      const score = parseCurrentScore(events);
      if (!score) continue;

      const prev = goalCache[f.FixtureId] || { p1: 0, p2: 0, finishedSummarySent: false };
      
      let sendPush = false;
      let body = "";
      let title = "Live Match Alert";

      // 1. Goal Checks
      if (score.p1Goals > prev.p1) {
        sendPush = true;
        body = `GOAL! ${f.Participant1} scores! (${score.p1Goals} - ${score.p2Goals})`;
      } else if (score.p2Goals > prev.p2) {
        sendPush = true;
        body = `GOAL! ${f.Participant2} scores! (${score.p1Goals} - ${score.p2Goals})`;
      }

      // 2. Full Time Summary Check
      if (score.isFinished && !prev.finishedSummarySent && !sendPush) {
        sendPush = true;
        title = "Full Time Summary";
        body = `FT: ${f.Participant1} ${score.p1Goals} - ${score.p2Goals} ${f.Participant2}\n` +
               `🟨 ${score.p1Yellow}-${score.p2Yellow} | 🟥 ${score.p1Yellow}-${score.p2Yellow} | ⛳ ${score.p1Corners}-${score.p2Corners}`;
        // Note: the red cards variable isn't parsed in parseCurrentScore yet, but we have yellow and corners.
        // Let's adjust string for what we have:
        body = `FT: ${f.Participant1} ${score.p1Goals} - ${score.p2Goals} ${f.Participant2}\n` +
               `Yellows: ${score.p1Yellow}-${score.p2Yellow} | Corners: ${score.p1Corners}-${score.p2Corners}`;
      }

      if (sendPush) {
        // Send push
        const payload = JSON.stringify({
          title,
          body,
          data: { url: `/match/${f.FixtureId}` }
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification(sub, payload);
          } catch (e) {
            if (typeof e === "object" && e !== null && "statusCode" in e && e.statusCode === 410) {
              // subscription expired/unsubscribed
            } else {
              console.error("Push error:", e);
            }
          }
        }
      }

      goalCache[f.FixtureId] = { 
        p1: score.p1Goals, 
        p2: score.p2Goals, 
        finishedSummarySent: prev.finishedSummarySent || (score.isFinished && sendPush)
      };
    }

    return NextResponse.json({ ok: true, checked: liveFixtures.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Push cron failed" }, { status: 500 });
  }
}
