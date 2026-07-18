import { NextResponse } from "next/server";
import webpush from "web-push";
import { getFixtures } from "@/lib/txline/server";
import { type TxFixture } from "@/lib/txline/types";
import { getAllSubscriptions } from "@/lib/pulse/push-store";
import { getSubs, sendTo } from "@/lib/telegram/server";
import { matchPhase } from "@/lib/pulse/format";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.NEXT_PRIVATE_VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails("mailto:contact@whistl.io", VAPID_PUBLIC, VAPID_PRIVATE);
}

// Fired by Vercel cron every 6 hours
export async function GET() {
  try {
    const fixtures = (await getFixtures({
      startEpochDay: Math.floor(Date.now() / 86_400_000),
    })) as TxFixture[];
    
    const now = Date.now();
    const upcoming = fixtures
      .filter((f) => matchPhase(f.StartTime, now) === "upcoming")
      .sort((a, b) => a.StartTime - b.StartTime);

    const next = upcoming[0];
    if (!next) {
      return NextResponse.json({ ok: true, msg: "No upcoming matches found" });
    }

    const timeString = new Date(next.StartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const textMsg = `📅 UPCOMING MATCH\n${next.Participant1} vs ${next.Participant2}\nKicks off at ${timeString}`;

    // 1. Send Telegram broadcast
    const tgSubs = await getSubs();
    let tgSent = 0;
    for (const sub of tgSubs) {
      await sendTo(sub, textMsg);
      tgSent++;
    }

    // 2. Send Web Push broadcast
    let webSent = 0;
    if (VAPID_PUBLIC && VAPID_PRIVATE) {
      const webSubs = getAllSubscriptions();
      const payload = JSON.stringify({
        title: "Next Match",
        body: `${next.Participant1} vs ${next.Participant2} at ${timeString}`,
        data: { url: `/match/${next.FixtureId}` }
      });

      for (const sub of webSubs) {
        try {
          await webpush.sendNotification(sub, payload);
          webSent++;
        } catch (e) {
          // ignore expired
        }
      }
    }

    return NextResponse.json({ ok: true, nextMatch: next.FixtureId, tgSent, webSent });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Next match cron failed" }, { status: 500 });
  }
}
