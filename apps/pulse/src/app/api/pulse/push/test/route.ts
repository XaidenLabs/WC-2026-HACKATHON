import { NextResponse } from "next/server";
import webpush from "web-push";
import { getAllSubscriptions } from "@/lib/pulse/push-store";

// Guard: setVapidDetails throws on missing/invalid keys, which would crash the whole route
// on import (and fail the production build during page-data collection).
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.NEXT_PRIVATE_VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails("mailto:contact@whistl.io", VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    console.error("[push/test] invalid VAPID keys:", (e as Error).message);
  }
}

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
