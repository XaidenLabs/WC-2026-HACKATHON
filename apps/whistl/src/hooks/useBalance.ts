"use client";

import { useCallback, useEffect, useState } from "react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { usePrivy } from "@privy-io/react-auth";
import { TEST_USDC_MINT } from "@/lib/whistl/program";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";
const POLL_MS = 15_000;

export type Balance = {
  usdc: number | null;   // test-USDC, null = ATA doesn't exist yet
  sol: number | null;
  loading: boolean;
  walletAddress: string | null;
  refresh: () => void;
};

export function useBalance(): Balance {
  const { user } = usePrivy();
  const walletAddress = user?.wallet?.address ?? null;

  const [usdc, setUsdc] = useState<number | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!walletAddress) { setUsdc(null); setSol(null); return; }
    setLoading(true);
    try {
      const conn = new Connection(RPC, "confirmed");
      const pk = new PublicKey(walletAddress);

      const [lamports, ataInfo] = await Promise.all([
        conn.getBalance(pk).catch(() => null),
        conn.getTokenAccountBalance(getAssociatedTokenAddressSync(TEST_USDC_MINT, pk)).catch(() => null),
      ]);

      setSol(lamports != null ? lamports / LAMPORTS_PER_SOL : null);
      setUsdc(ataInfo?.value?.uiAmount ?? 0);
    } catch {
      // RPC blip — keep last values
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { usdc, sol, loading, walletAddress, refresh };
}
