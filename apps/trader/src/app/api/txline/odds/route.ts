import { NextResponse } from "next/server";
import { getOddsSnapshot, TxlineTokenMissing } from "@/lib/txline/server";
import { parse1X2, parseOU, type TxOddsEntry } from "@/lib/txline/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fixtureIdStr = searchParams.get("fixtureId");
  if (!fixtureIdStr) return NextResponse.json({ ok: false, error: "Missing fixtureId" }, { status: 400 });
  const fixtureId = Number(fixtureIdStr);

  try {
    const oddsData = await getOddsSnapshot(fixtureId);
    // Parse 1X2 + Over/Under goals markets for the frontend.
    const odds = parse1X2(oddsData as TxOddsEntry[]);
    const ou = parseOU(oddsData as TxOddsEntry[]);
    return NextResponse.json({ ok: true, odds, ou });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
