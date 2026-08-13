import { NextResponse } from "next/server";
import { getMarketFixtures } from "@/lib/market-data/server";
import { SportmonksTokenMissing } from "@/lib/sportmonks/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId: rawFixtureId } = await context.params;
  const fixtureId = Number(rawFixtureId);
  if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
    return NextResponse.json({ ok: false, error: "BAD_FIXTURE_ID" }, { status: 400 });
  }
  try {
    const fixture = (await getMarketFixtures({ fixtureId }))[0];
    if (!fixture) return NextResponse.json({ ok: false, error: "FIXTURE_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true, source: "sportmonks", score: fixture.score ?? null });
  } catch (error) {
    if (error instanceof SportmonksTokenMissing) {
      return NextResponse.json({ ok: false, error: "SPORTMONKS_API_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 502 });
  }
}
