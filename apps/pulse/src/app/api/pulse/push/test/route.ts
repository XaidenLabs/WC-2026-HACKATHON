import { NextResponse } from "next/server";
import webpush from "web-push";
import { getAllSubscriptions } from "@/lib/pulse/push-store";

webpush.setVapidDetails(
  "mailto:contact@whistl.io",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
  process.env.NEXT_PRIVATE_VAPID_PRIVATE_KEY as string
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const p1 = url.searchParams.get("p1") || "Germany";
    const p2 = url.searchParams.get("p2") || "Paraguay";
    const scorer = url.searchParams.get("scorer") || p1;
    const score = url.searchParams.get("score") || "1 - 0";

    const subs = getAllSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ ok: false, error: "No active subscriptions in memory." });
    }

    const payload = JSON.stringify({
      title: "Live Match Alert",
      body: `GOAL! ${scorer} scores! (${score})`,
      data: { url: `/` }
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (e) {
        console.error("Test push failed", e);
      }
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
