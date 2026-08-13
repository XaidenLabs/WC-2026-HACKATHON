import { NextResponse } from "next/server";
import { processAutonomousEngine } from "@/lib/supervision/service";

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await processAutonomousEngine()) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
