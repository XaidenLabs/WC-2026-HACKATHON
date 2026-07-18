"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTraderWallet } from "@/hooks/useTraderWallet";

type Sel = "home" | "draw" | "away" | "over" | "under";

/**
 * One-tap "back this pick": gates on sign-in, creates a TxLINE-priced position, then routes to the
 * bet's own prediction receipt. Powers the home feed and the match desk's ORA-pick button.
 */
export function useBackBet() {
  const router = useRouter();
  const { authenticated, login, getAccessToken, mutateWallet } = useTraderWallet();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function back(input: { fixtureId: number; match: string; selection: Sel; odds: number; stake?: number; market?: "1x2" | "goals_ou"; line?: number }) {
    if (!authenticated) { login(); return; }
    setPendingId(input.fixtureId);
    setError(null);
    try {
      const token = await getAccessToken();
      const r = await fetch("/api/trader/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stake: 50, ...input }),
      });
      const j = await r.json();
      if (!j.ok) { setError(j.error || "Couldn't place bet"); setPendingId(null); return; }
      mutateWallet();
      router.push(`/prediction/${j.bet.id}`);
    } catch (e) {
      setError((e as Error).message);
      setPendingId(null);
    }
  }

  return { back, pendingId, authenticated, error };
}
