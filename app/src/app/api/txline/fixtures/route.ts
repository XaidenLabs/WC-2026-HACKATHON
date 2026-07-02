import { NextResponse } from "next/server";
import { getFixtures, TxlineTokenMissing } from "@/lib/txline/server";

// Live fixtures proxy. Holds the TxLINE token server-side; the browser calls this.
// Not cached (route handlers are dynamic by default), so data is always live.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startEpochDay = searchParams.get("startEpochDay");
  const competitionId = searchParams.get("competitionId");

  try {
    const fixtures = await getFixtures({
      startEpochDay: startEpochDay ? Number(startEpochDay) : undefined,
      competitionId: competitionId ? Number(competitionId) : undefined,
    });
    return NextResponse.json({ ok: true, source: "live", fixtures });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
        return NextResponse.json(
        { ok: false, error: "TXLINE_TOKEN_MISSING" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 },
    );
  }
}
