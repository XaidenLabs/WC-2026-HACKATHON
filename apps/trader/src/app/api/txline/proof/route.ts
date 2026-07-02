import { NextResponse } from "next/server";
import { getScoresSnapshot, getStatValidation, TxlineTokenMissing } from "@/lib/txline/server";
import type { TxScoreEvent } from "@/lib/txline/types";

// GET /api/txline/proof?fixtureId=X&statAKey=1&statBKey=2
// Fetches the latest Merkle proof bundle for a given fixture and stat key(s).
// Used by the keeper settler to verify payouts before calling settle_pact.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fixtureId = Number(url.searchParams.get("fixtureId"));
  const statAKey = Number(url.searchParams.get("statAKey"));
  const statBKey = url.searchParams.get("statBKey");

  if (!fixtureId || !statAKey) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  try {
    // Find the latest seq from the scores snapshot
    const events = (await getScoresSnapshot(fixtureId)) as TxScoreEvent[];
    const latestSeq = events.reduce((max, e) => Math.max(max, e.Seq), 0);

    if (!latestSeq) {
      return NextResponse.json({ ok: false, error: "NO_EVENTS" }, { status: 404 });
    }

    // Fetch the stat-validation proof bundle
    const proof = await getStatValidation({
      fixtureId,
      seq: latestSeq,
      statKey: statAKey,
      ...(statBKey ? { statKey2: Number(statBKey) } : {}),
    });
    return NextResponse.json({ ok: true, seq: latestSeq, proof });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
