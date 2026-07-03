import "server-only";
import { randomUUID } from "crypto";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

// Per-user paper-trading wallet. Everyone starts with 1000 paper USDC. Placing a bet locks the
// stake; when the match settles against the real TxLINE result, a winning bet is paid out
// (stake × odds). Persisted in Supabase (`trader_bets`), with an in-memory fallback for demos.

export const STARTING_BALANCE = 1000;

export type Selection = "home" | "draw" | "away";
export type BetStatus = "open" | "won" | "lost";

export type Bet = {
  id: string;
  user_did: string;
  fixture_id: number;
  match: string;
  selection: Selection;
  odds: number;
  stake: number;
  status: BetStatus;
  pnl: number | null;
  created_at: string;
};

let backend: "supabase" | "memory" | null = null;
async function resolveBackend(): Promise<"supabase" | "memory"> {
  if (backend) return backend;
  if (!supabaseConfigured()) return (backend = "memory");
  const { error } = await supabaseAdmin().from("trader_bets").select("id").limit(1);
  backend = error ? "memory" : "supabase";
  if (error) console.warn("[trader] trader_bets table missing — using in-memory store. Run supabase/trader.sql to persist.");
  return backend;
}

const mem: Bet[] = [];

export async function getUserBets(userDid: string): Promise<Bet[]> {
  if ((await resolveBackend()) === "supabase") {
    const { data } = await supabaseAdmin()
      .from("trader_bets")
      .select("*")
      .eq("user_did", userDid)
      .order("created_at", { ascending: false });
    return (data as Bet[]) ?? [];
  }
  return mem.filter((b) => b.user_did === userDid).sort((a, b) => b.created_at.localeCompare(a.created_at));
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
  input: { fixtureId: number; match: string; selection: Selection; odds: number; stake: number },
): Promise<{ ok: true; bet: Bet } | { ok: false; error: string }> {
  const { fixtureId, match, selection, odds, stake } = input;
  if (!(stake > 0)) return { ok: false, error: "Stake must be positive" };
  if (!(odds > 1)) return { ok: false, error: "Invalid odds" };

  const bets = await getUserBets(userDid);
  const bal = balanceOf(bets);
  if (stake > bal) return { ok: false, error: `Not enough balance — you have ${bal} USDC` };

  const bet: Bet = {
    id: randomUUID(),
    user_did: userDid,
    fixture_id: fixtureId,
    match,
    selection,
    odds: Math.round(odds * 1000) / 1000,
    stake: Math.round(stake * 100) / 100,
    status: "open",
    pnl: null,
    created_at: new Date().toISOString(),
  };

  if ((await resolveBackend()) === "supabase") {
    const { error } = await supabaseAdmin().from("trader_bets").insert({
      id: bet.id, user_did: userDid, fixture_id: fixtureId, match, selection, odds: bet.odds, stake: bet.stake, status: "open",
    });
    if (error) return { ok: false, error: error.message };
  } else {
    mem.push(bet);
  }
  return { ok: true, bet };
}

export async function markSettled(betId: string, status: "won" | "lost", pnl: number): Promise<void> {
  if ((await resolveBackend()) === "supabase") {
    await supabaseAdmin().from("trader_bets").update({ status, pnl }).eq("id", betId);
  } else {
    const b = mem.find((x) => x.id === betId);
    if (b) { b.status = status; b.pnl = pnl; }
  }
}
