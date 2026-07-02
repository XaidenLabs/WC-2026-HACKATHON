import { NextResponse } from "next/server";
import { getScoresSnapshot, getScoresHistorical, TxlineTokenMissing } from "@/lib/txline/server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await ctx.params;
  const id = Number(fixtureId);

  try {
    // snapshot = latest per-action scores (best for current state of a live match)
    const scores = await getScoresSnapshot(id);
    if (Array.isArray(scores) && scores.length > 0) {
      return NextResponse.json({ ok: true, scores, source: "snapshot" });
    }
    // historical = full sequence (2 weeks → 6h past) — works for finished matches
    const hist = await getScoresHistorical(id);
    return NextResponse.json({ ok: true, scores: hist, source: "historical" });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
