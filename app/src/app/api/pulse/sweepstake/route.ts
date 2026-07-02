import { NextResponse } from "next/server";
import { createSweepstake } from "@/lib/pulse/sweepstore";

// POST /api/pulse/sweepstake — create a group. Body: { name, creatorName }
// Returns the group code + the creator's member record (id is their private handle).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim().slice(0, 60);
  const creatorName = String(body?.creatorName ?? "").trim().slice(0, 40);

  if (!name || !creatorName) {
    return NextResponse.json({ ok: false, error: "Need a group name and your name" }, { status: 400 });
  }

  try {
    const { sweepstake, member } = await createSweepstake(name, creatorName);
    return NextResponse.json({ ok: true, code: sweepstake.code, member });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
