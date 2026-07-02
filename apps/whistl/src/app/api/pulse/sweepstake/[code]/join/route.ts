import { NextResponse } from "next/server";
import { joinSweepstake } from "@/lib/pulse/sweepstore";

// POST /api/pulse/sweepstake/[code]/join — Body: { name }
// Assigns a random World Cup team and returns the new member (id = private handle).
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params;
  const code = raw.toUpperCase();
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim().slice(0, 40);

  if (!name) {
    return NextResponse.json({ ok: false, error: "Enter your name to join" }, { status: 400 });
  }

  try {
    const member = await joinSweepstake(code, name);
    if (!member) {
      return NextResponse.json({ ok: false, error: "GROUP_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, member });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
