import "server-only";
import { randomUUID } from "crypto";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

// Per-user live-data simulation wallet. Every position is priced from TxLINE and settled only
// from a TxLINE final score. Persistence is mandatory: an in-memory fallback would create
// receipts that disappear and must never be presented as a trading record.

export const STARTING_BALANCE = 1000;

export type Market = "1x2" | "goals_ou";
export type Selection = "home" | "draw" | "away" | "over" | "under";
export type BetStatus = "open" | "won" | "lost";

export type Bet = {
  id: string;
  user_did: string;
  fixture_id: number;
  match: string;
  market: Market;         // "1x2" = match winner, "goals_ou" = total goals over/under `line`
  line: number | null;    // only for goals_ou (e.g. 2.5)
  selection: Selection;
  odds: number;
  stake: number;
  status: BetStatus;
  pnl: number | null;
  created_at: string;
};

/** Decide a settled bet's outcome from the real final score. Handles 1X2 and goals O/U. */
export function evaluateBet(bet: Pick<Bet, "market" | "line" | "selection">, p1Goals: number, p2Goals: number): "won" | "lost" {
  if (bet.market === "goals_ou" && bet.line != null) {
    const over = p1Goals + p2Goals > bet.line;
    return (bet.selection === "over" ? over : !over) ? "won" : "lost";
  }
  const result = p1Goals > p2Goals ? "home" : p2Goals > p1Goals ? "away" : "draw";
  return result === bet.selection ? "won" : "lost";
}

let backendReady: boolean | null = null;
async function requireBackend(): Promise<void> {
  if (backendReady) return;
  if (!supabaseConfigured()) throw new Error("TRADING_STORE_UNAVAILABLE");
  const { error } = await supabaseAdmin().from("trader_bets").select("id").limit(1);
  if (error) throw new Error("TRADING_STORE_UNAVAILABLE");
  backendReady = true;
}

export async function getUserBets(userDid: string): Promise<Bet[]> {
  await requireBackend();
  const { data } = await supabaseAdmin()
    .from("trader_bets")
    .select("*")
    .eq("user_did", userDid)
    .order("created_at", { ascending: false });
  return (data as Bet[]) ?? [];
}

/** Fetch a single bet by id (any user) — powers the public, shareable prediction page. */
export async function getBet(id: string): Promise<Bet | null> {
  await requireBackend();
  const { data } = await supabaseAdmin().from("trader_bets").select("*").eq("id", id).maybeSingle();
  return (data as Bet) ?? null;
}

/** Balance = 1000 − every stake placed + every winning payout (stake × odds). */
export function balanceOf(bets: Bet[]): number {
  let bal = STARTING_BALANCE;
  for (const b of bets) {
    bal -= b.stake;
    if (b.status === "won") bal += b.stake * b.odds;
  }
  return Math.round(bal * 100) / 100;
}

export async function placeBet(
  userDid: string,
  input: { fixtureId: number; match: string; selection: Selection; odds: number; stake: number; market?: Market; line?: number | null },
): Promise<{ ok: true; bet: Bet } | { ok: false; error: string }> {
  const { fixtureId, match, selection, odds, stake } = input;
  const market: Market = input.market ?? "1x2";
  const line = market === "goals_ou" ? (input.line ?? null) : null;
  if (!(stake > 0)) return { ok: false, error: "Stake must be positive" };
  if (!(odds > 1)) return { ok: false, error: "Invalid odds" };
  if (market === "goals_ou" && line == null) return { ok: false, error: "Missing goals line" };

  const bets = await getUserBets(userDid);
  const bal = balanceOf(bets);
  if (stake > bal) return { ok: false, error: `Not enough balance · you have ${bal} USDC` };

  const bet: Bet = {
    id: randomUUID(),
    user_did: userDid,
    fixture_id: fixtureId,
    match,
    market,
    line,
    selection,
    odds: Math.round(odds * 1000) / 1000,
    stake: Math.round(stake * 100) / 100,
    status: "open",
    pnl: null,
    created_at: new Date().toISOString(),
  };

  await requireBackend();
  const { error } = await supabaseAdmin().from("trader_bets").insert({
      id: bet.id, user_did: userDid, fixture_id: fixtureId, match, market, line, selection, odds: bet.odds, stake: bet.stake, status: "open",
    });
  if (error) {
      // Migration not applied yet (no market/line columns). 1X2 still works without them;
      // goals bets require the migration.
      const missingCols = /column .*(market|line)/i.test(error.message);
      if (missingCols && market === "1x2") {
        const retry = await supabaseAdmin().from("trader_bets").insert({
          id: bet.id, user_did: userDid, fixture_id: fixtureId, match, selection, odds: bet.odds, stake: bet.stake, status: "open",
        });
        if (retry.error) return { ok: false, error: retry.error.message };
      } else if (missingCols) {
        return { ok: false, error: "Goals betting needs a quick DB migration · run supabase/trader.sql." };
      } else {
        return { ok: false, error: error.message };
      }
  }
  return { ok: true, bet };
}

export async function markSettled(betId: string, status: "won" | "lost", pnl: number): Promise<void> {
  await requireBackend();
  await supabaseAdmin().from("trader_bets").update({ status, pnl }).eq("id", betId);
}
