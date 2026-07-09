import { NextResponse } from "next/server";
import { getFixtures, getOddsSnapshot, TxlineTokenMissing } from "@/lib/txline/server";
import { parse1X2, type TxFixture, type TxOddsEntry } from "@/lib/txline/types";
import { oraPick } from "@/lib/ora/pick";
import { formatCall, parseCall, type AgentCall } from "@/lib/agent/call";
import { devnetConnection, oraPubkey, inscribe, explorerUrl } from "@/lib/agent/onchain";

// GET /api/agent/autopilot — ONE autonomous ORA cycle. No human input, no strategy to configure.
// ORA scans live TxLINE markets, runs its value model, and inscribes a call on Solana for every
// positive-expected-value opportunity it has not already taken. This is the endpoint a cron (see
// vercel.json) hits on a schedule, so ORA runs itself. It is also callable from the UI so the
// autonomy is visible during a demo.
//
// Guardrails: it only ever inscribes ORA's OWN value calls, dedupes against ORA's on-chain history
// so it never spams the same match, and caps how many it fires per cycle.

const MAX_SCAN = 8;
const MAX_INSCRIBE = 3;

export async function GET(req: Request) {
  // Optional cron protection: if CRON_SECRET is set, a bearer-token match is required.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      // Still allow same-origin UI calls (which do not carry the secret) but block open internet cron abuse.
      const isInternal = req.headers.get("x-autopilot-ui") === "1";
      if (!isInternal) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  try {
    const now = Date.now();
    const fixtures = (await getFixtures({ startEpochDay: Math.floor(now / 86_400_000) - 1 })) as TxFixture[];
    const candidates = fixtures
      .filter((f) => now < f.StartTime + 2.5 * 3600 * 1000) // live or upcoming
      .sort((a, b) => a.StartTime - b.StartTime)
      .slice(0, MAX_SCAN);

    // Dedupe against ORA's on-chain history so it does not re-call the same match every cycle.
    const already = new Set<number>();
    try {
      const conn = devnetConnection();
      const sigs = await conn.getSignaturesForAddress(oraPubkey(), { limit: 100 });
      for (const s of sigs) {
        if (!s.memo) continue;
        const c = parseCall(s.memo);
        if (c?.fixtureId != null) already.add(c.fixtureId);
      }
    } catch { /* history read failed; proceed without dedupe */ }

    let scanned = 0;
    let valueFound = 0;
    const inscribed: (AgentCall & { fixtureId: number; evPct: number; signature: string; explorerUrl: string })[] = [];
    const passed: { match: string; reason: string }[] = [];

    for (const f of candidates) {
      if (inscribed.length >= MAX_INSCRIBE) break;
      if (already.has(f.FixtureId)) continue;
      let pick;
      try {
        pick = oraPick(parse1X2((await getOddsSnapshot(f.FixtureId)) as TxOddsEntry[]));
      } catch {
        continue; // unpriced market
      }
      if (!pick) continue;
      scanned++;
      const match = `${f.Participant1} v ${f.Participant2}`;
      if (!pick.value) {
        passed.push({ match, reason: "no positive expected value" });
        continue;
      }
      valueFound++;
      const team = pick.selection === "home" ? f.Participant1 : pick.selection === "away" ? f.Participant2 : "the Draw";
      const call: AgentCall = {
        strategy: "ORA Value Model",
        match,
        side: "back",
        selection: pick.selection,
        odds: pick.dec,
        reasoning: `${pick.confidence}: backs ${team} at ${pick.dec.toFixed(2)}× (model ${pick.prob}% vs market ${pick.marketProb}%, EV ${pick.evPct >= 0 ? "+" : ""}${pick.evPct}%).`,
        fixtureId: f.FixtureId,
      };
      try {
        const signature = await inscribe(formatCall(call));
        inscribed.push({ ...call, fixtureId: f.FixtureId, evPct: pick.evPct, signature, explorerUrl: explorerUrl(signature) });
      } catch (e) {
        console.error("[autopilot] inscribe failed:", (e as Error).message);
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: now,
      scanned: candidates.length,
      priced: scanned,
      valueFound,
      inscribed: inscribed.length,
      calls: inscribed,
      passed,
    });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
