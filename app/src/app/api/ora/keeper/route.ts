import { NextResponse } from "next/server";
import { getScoresSnapshot, getScoresHistorical } from "@/lib/txline/server";
import type { TxScoreEvent } from "@/lib/txline/types";
import {
  startWatch,
  getState,
  getAllWatchers,
  clearWatcher,
  runReplay,
  type PactRecord,
} from "@/lib/ora/keeper";

// POST /api/ora/keeper — start watching a fixture (replay mode by default)
// Body: { fixtureId, p1, p2, pacts: PactRecord[], speed?: number }
//
// Scores are fetched BEFORE responding (while the request context is alive) so the
// background replay loop never needs to make outbound network calls for data.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { fixtureId, p1, p2, pacts, speed = 6 } = body;
  if (!fixtureId || !p1 || !p2) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  // If already running, return current state
  const existing = getState(Number(fixtureId));
  if (existing && (existing.status === "watching" || existing.status === "settling")) {
    return NextResponse.json({ ok: true, status: existing.status, resumed: true });
  }
  if (existing) clearWatcher(Number(fixtureId));

  // Fetch scores NOW (while the request context is active) — background tasks can't fetch
  let rawEvents: TxScoreEvent[] = [];
  try {
    const hist = (await getScoresHistorical(Number(fixtureId))) as TxScoreEvent[];
    if (Array.isArray(hist) && hist.length > 0) rawEvents = hist;
  } catch {
    // historical may be unavailable
  }
  if (rawEvents.length === 0) {
    try {
      const snap = (await getScoresSnapshot(Number(fixtureId))) as TxScoreEvent[];
      if (Array.isArray(snap)) rawEvents = snap;
    } catch {
      // snapshot also unavailable
    }
  }

  if (rawEvents.length === 0) {
    return NextResponse.json({ ok: false, error: "NO_SCORE_DATA" }, { status: 503 });
  }

  const state = startWatch(Number(fixtureId), p1, p2, (pacts ?? []) as PactRecord[], Number(speed));

  // Replay runs in the background — all data is already in memory, no network needed
  void runReplay(Number(fixtureId), rawEvents).catch((e) => {
    const s = getState(Number(fixtureId));
    if (s) {
      s.events.push({ id: Date.now(), ts: Date.now(), kind: "settle_error", message: `Replay error: ${(e as Error).message}` });
      s.status = "error";
    }
  });

  return NextResponse.json({
    ok: true,
    status: state.status,
    pactCount: (pacts ?? []).length,
    eventCount: rawEvents.length,
  });
}

// GET /api/ora/keeper — list all active watchers
export async function GET() {
  const watchers = getAllWatchers().map((w) => ({
    fixtureId: w.fixtureId,
    p1: w.p1,
    p2: w.p2,
    status: w.status,
    pactCount: w.pacts.length,
    settledCount: w.settled.size,
    startedAt: w.startedAt,
    currentScore: w.currentScore,
    lastEventId: w.events.at(-1)?.id ?? 0,
  }));
  return NextResponse.json({ ok: true, watchers });
}
