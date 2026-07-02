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

    return NextResponse.json({ ok: true, calls, record });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
