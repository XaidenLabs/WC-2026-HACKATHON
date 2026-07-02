import { NextResponse } from "next/server";
import { getOddsSnapshot, TxlineTokenMissing } from "@/lib/txline/server";

// Live odds for one fixture (used by ORA to price goal markets from the real consensus line).
// Optional ?asOf=<unix ms> returns odds as they were at that time (for movement comparisons).
export async function GET(req: Request, ctx: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await ctx.params;
  const asOf = new URL(req.url).searchParams.get("asOf");
  try {
    const odds = await getOddsSnapshot(Number(fixtureId), asOf ? Number(asOf) : undefined);
    return NextResponse.json({ ok: true, odds });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
