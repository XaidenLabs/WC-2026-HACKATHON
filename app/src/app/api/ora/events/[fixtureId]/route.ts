import { NextResponse } from "next/server";
import { getEvents, getState } from "@/lib/ora/keeper";

// GET /api/ora/events/{fixtureId}?since=<lastEventId>
// Returns all keeper events newer than `since` (polling; client calls every 1-2s).
export async function GET(
  req: Request,
  ctx: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await ctx.params;
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") ?? 0);

  const state = getState(Number(fixtureId));
  if (!state) {
    return NextResponse.json({ ok: false, error: "NOT_WATCHING" }, { status: 404 });
  }

  const events = getEvents(Number(fixtureId), since);
  return NextResponse.json({
    ok: true,
    events,
    status: state.status,
    settled: [...state.settled],
    currentScore: state.currentScore,
    lastId: state.events.at(-1)?.id ?? 0,
  });
}
