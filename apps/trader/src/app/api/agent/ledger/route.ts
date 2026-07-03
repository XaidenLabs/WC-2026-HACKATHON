import { NextResponse } from "next/server";
import { devnetConnection, oraPubkey, explorerUrl } from "@/lib/agent/onchain";
import { parseCall } from "@/lib/agent/call";
import { getScoresSnapshot, getFixtures } from "@/lib/txline/server";
import { parseCurrentScore, type TxFixture, type TxScoreEvent } from "@/lib/txline/types";
import type { Selection } from "@/lib/agent/strategy";

// GET /api/agent/ledger — ORA's verifiable track record, read from its Solana memo history and
// SETTLED against the real TxLINE result: once a call's match ends, we prove whether ORA was
// right. Nothing can be faked — the call is on-chain, the result is Merkle-verifiable.

const MAX_SETTLE = 20;

function resultOf(p1: number, p2: number): Selection {
  if (p1 > p2) return "home";
  if (p2 > p1) return "away";
  return "draw";
}

export async function GET() {
  try {
    const conn = devnetConnection();
    const sigs = await conn.getSignaturesForAddress(oraPubkey(), { limit: 100 });

    const parsed = sigs
      .filter((s) => s.memo && !s.err)
      .map((s) => ({ call: parseCall(s.memo as string), sig: s.signature, blockTime: s.blockTime }))
      .filter((x) => x.call !== null)
      .sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));

    // Map "P1 v P2" → fixtureId so older calls (inscribed before we embedded FX#) still settle.
    const nameToId = new Map<string, number>();
    try {
      const fixtures = (await getFixtures({ startEpochDay: Math.floor(Date.now() / 86_400_000) - 21 })) as TxFixture[];
      for (const f of fixtures) nameToId.set(`${f.Participant1} v ${f.Participant2}`, f.FixtureId);
    } catch {
      /* name fallback unavailable — FX#-tagged calls still settle */
    }

    const calls = await Promise.all(
      parsed.slice(0, MAX_SETTLE).map(async (x) => {
        const c = x.call!;
        let status: "won" | "lost" | "pending" = "pending";
        let finalScore: string | null = null;
        const fixtureId = c.fixtureId ?? nameToId.get(c.match);

        if (fixtureId != null) {
          try {
            const ps = parseCurrentScore((await getScoresSnapshot(fixtureId)) as TxScoreEvent[]);
            if (ps?.isFinished) {
              const result = resultOf(ps.p1Goals, ps.p2Goals);
              const selectionWon = result === c.selection;
              const won = c.side === "back" ? selectionWon : !selectionWon;
              status = won ? "won" : "lost";
              finalScore = `${ps.p1Goals}-${ps.p2Goals}`;
            }
          } catch {
            /* leave pending on score error */
          }
        }

        return {
          ...c,
          status,
          finalScore,
          timestamp: (x.blockTime ?? 0) * 1000,
          signature: x.sig,
          explorerUrl: explorerUrl(x.sig),
        };
      }),
    );

    const record = {
      won: calls.filter((c) => c.status === "won").length,
      lost: calls.filter((c) => c.status === "lost").length,
      pending: calls.filter((c) => c.status === "pending").length,
    };

    // ── ORA's wallet/bankroll: flat 100-unit stake per call, starting balance 1000. Each
    //    settled call credits its winnings / debits its stake, chronologically.
    const STAKE = 100;
    const START = 1000;
    const settledChrono = calls.filter((c) => c.status !== "pending").sort((a, b) => a.timestamp - b.timestamp);
    let bankroll = START;
    let netPnl = 0;
    let staked = 0;
    const equity: { i: number; bankroll: number }[] = [{ i: 0, bankroll: START }];
    const pnlBySig = new Map<string, number>();
    settledChrono.forEach((c, idx) => {
      const p = c.status === "won" ? STAKE * (c.odds - 1) : -STAKE;
      bankroll += p;
      netPnl += p;
      staked += STAKE;
      pnlBySig.set(c.signature, Math.round(p * 100) / 100);
      equity.push({ i: idx + 1, bankroll: Math.round(bankroll * 100) / 100 });
    });
    const callsWithPnl = calls.map((c) => ({ ...c, stake: STAKE, pnl: pnlBySig.get(c.signature) ?? null }));

    const settledCount = record.won + record.lost;
    const metrics = {
      startingBankroll: START,
      bankroll: Math.round(bankroll * 100) / 100,
      netPnl: Math.round(netPnl * 100) / 100,
      staked,
      roi: staked ? Math.round((netPnl / staked) * 1000) / 1000 : 0,
      hitRate: settledCount ? Math.round((record.won / settledCount) * 100) / 100 : 0,
      settled: settledCount,
      equity,
    };

    return NextResponse.json({ ok: true, calls: callsWithPnl, record, metrics });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
