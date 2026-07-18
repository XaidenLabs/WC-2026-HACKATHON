"use client";

import useSWR from "swr";
import { usePrivy } from "@privy-io/react-auth";

export type Position = {
  id: string;
  fixture_id: number;
  match: string;
  selection: "home" | "draw" | "away";
  odds: number;
  stake: number;
  status: "open" | "won" | "lost";
  pnl: number | null;
  finalScore: string | null;
  created_at: string;
};

export type WalletData = {
  ok: boolean;
  startingBalance: number;
  balance: number;
  netPnl: number;
  open: number;
  settled: number;
  wins: number;
  positions: Position[];
};

/** Privy auth + the signed-in user's TxLINE-priced devnet position view (refreshes every 30s). */
export function useTraderWallet() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();

  const { data, mutate, isLoading } = useSWR<WalletData>(
    authenticated ? "trader-wallet" : null,
    async () => {
      const token = await getAccessToken();
      const r = await fetch("/api/trader/wallet", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );

  return {
    ready,
    authenticated,
    login,
    logout,
    email: user?.email?.address ?? null,
    getAccessToken,
    wallet: data?.ok ? data : null,
    loadingWallet: isLoading,
    mutateWallet: mutate,
  };
}
