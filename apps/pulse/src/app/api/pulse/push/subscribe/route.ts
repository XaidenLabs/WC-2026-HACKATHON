import { NextResponse } from "next/server";
import { addSubscription } from "@/lib/pulse/push-store";
import type { PushSubscription } from "web-push";

export async function POST(req: Request) {
  try {
    const subscription = (await req.json()) as PushSubscription;
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
    }
    
    addSubscription(subscription);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Failed to parse subscription" }, { status: 400 });
  }
}
