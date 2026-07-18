import { NextResponse } from "next/server";
import { verifyPrivyToken, privyConfigured } from "@/lib/auth/privy-server";
import { getUserBets, balanceOf, markSettled, evaluateBet, STARTING_BALANCE } from "@/lib/trader/betstore";
import { getScoresSnapshot } from "@/lib/txline/server";
import { parseCurrentScore, type TxScoreEvent } from "@/lib/txline/types";

// GET /api/trader/wallet — the signed-in user's research wallet: saved sandbox reads. Open bets on
// finished matches are settled against the real TxLINE result and paid out on read.

async function authDid(req: Request): Promise<string | null> {
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return null;
  try {
    return await verifyPrivyToken(token);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  if (!privyConfigured()) return NextResponse.json({ ok: false, error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  const did = await authDid(req);
  if (!did) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const bets = await getUserBets(did);

    // Settle any open bet whose match has finished.
    const settleScores = new Map<number, ReturnType<typeof parseCurrentScore>>();
    await Promise.all(
      bets
        .filter((b) => b.status === "open")
        .map(async (b) => {
          try {
            const ps = parseCurrentScore((await getScoresSnapshot(b.fixture_id)) as TxScoreEvent[]);
            settleScores.set(b.fixture_id, ps);
            if (ps?.isFinished) {
              const won = evaluateBet(b, ps.p1Goals, ps.p2Goals) === "won";
              const pnl = Math.round((won ? b.stake * (b.odds - 1) : -b.stake) * 100) / 100;
              await markSettled(b.id, won ? "won" : "lost", pnl);
              b.status = won ? "won" : "lost";
              b.pnl = pnl;
            }
          } catch {
            /* leave open on error */
          }
        }),
    );

    // Attach a final-score label for settled bets.
    const positions = bets.map((b) => {
      const ps = settleScores.get(b.fixture_id);
      return { ...b, finalScore: ps?.isFinished ? `${ps.p1Goals}-${ps.p2Goals}` : null };
    });

    const balance = balanceOf(bets);
    const open = bets.filter((b) => b.status === "open").length;
    const settled = bets.length - open;

    return NextResponse.json({
      ok: true,
      startingBalance: STARTING_BALANCE,
      balance,
      netPnl: Math.round((balance - STARTING_BALANCE) * 100) / 100,
      open,
      settled,
      wins: bets.filter((b) => b.status === "won").length,
      positions,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
