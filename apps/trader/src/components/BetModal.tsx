"use client";

import { useState } from "react";
import useSWR from "swr";
import { X, Loader2, Check } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useTraderWallet } from "@/hooks/useTraderWallet";

function cn(...i: ClassValue[]) {
  return twMerge(clsx(i));
}
const fetcher = (url: string) => fetch(url).then((r) => r.json());
type Sel = "home" | "draw" | "away";

export type BetFixture = { FixtureId: number; Participant1: string; Participant2: string };

export default function BetModal({ fixture, onClose }: { fixture: BetFixture; onClose: () => void }) {
  const { authenticated, login, getAccessToken, wallet, mutateWallet } = useTraderWallet();
  const { data: oddsData } = useSWR<{ ok: boolean; odds?: { home: { dec: number }; draw: { dec: number }; away: { dec: number } } }>(
    `/api/txline/odds?fixtureId=${fixture.FixtureId}`, fetcher,
  );
  const odds = oddsData?.odds;

  const [sel, setSel] = useState<Sel | null>(null);
  const [stake, setStake] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const match = `${fixture.Participant1} v ${fixture.Participant2}`;
  const legs: { sel: Sel; label: string; dec?: number }[] = [
    { sel: "home", label: fixture.Participant1, dec: odds?.home?.dec },
    { sel: "draw", label: "Draw", dec: odds?.draw?.dec },
    { sel: "away", label: fixture.Participant2, dec: odds?.away?.dec },
  ];
  const selDec = sel ? legs.find((l) => l.sel === sel)?.dec : undefined;
  const payout = selDec ? stake * selDec : 0;
  const balance = wallet?.balance ?? null;
  const oddsLoading = !oddsData;

  async function place() {
    if (!sel || !selDec) return;
    setPlacing(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const r = await fetch("/api/trader/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fixtureId: fixture.FixtureId, match, selection: sel, odds: selDec, stake }),
      });
      const j = await r.json();
      if (!j.ok) { setError(j.error || "Couldn't place bet"); return; }
      setDone(true);
      mutateWallet();
      setTimeout(onClose, 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0a0a0a] p-5 font-mono" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Place a trade</p>
            <h3 className="text-sm font-bold text-white">{match}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="size-4" /></button>
        </div>

        {!authenticated ? (
          <div className="py-6 text-center">
            <p className="mb-3 text-sm text-gray-400">Sign in to trade with 1,000 free paper USDC.</p>
            <button onClick={login} className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400">
              Sign in with email
            </button>
          </div>
        ) : done ? (
          <div className="py-8 text-center text-emerald-400">
            <Check className="mx-auto size-8" />
            <p className="mt-2 text-sm font-bold">Trade placed!</p>
            <p className="text-[11px] text-gray-500">Settles automatically when the match ends.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {legs.map((l) => (
                <button key={l.sel} disabled={!l.dec} onClick={() => setSel(l.sel)}
                  className={cn("rounded-lg border p-2 text-center transition-colors",
                    sel === l.sel ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 bg-black hover:border-white/20",
                    !l.dec && "cursor-not-allowed opacity-40")}>
                  <p className="truncate text-[10px] text-gray-400">{l.sel === "draw" ? "Draw" : l.label}</p>
                  <p className="text-sm font-bold text-white">{oddsLoading ? "…" : l.dec ? `${l.dec.toFixed(2)}×` : "—"}</p>
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] text-gray-500">STAKE</span>
              {[25, 50, 100].map((v) => (
                <button key={v} onClick={() => setStake(v)}
                  className={cn("rounded border px-2.5 py-1 text-xs", stake === v ? "border-emerald-500 text-emerald-400" : "border-white/10 text-gray-400 hover:text-white")}>
                  {v}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-gray-500">balance {balance ?? "—"}</span>
            </div>

            {sel && (
              <div className="mt-3 rounded-lg border border-white/10 bg-black p-3 text-xs">
                <div className="flex justify-between text-gray-400"><span>Stake</span><span>{stake} USDC</span></div>
                <div className="mt-1 flex justify-between font-bold text-emerald-400"><span>If it wins, you get</span><span>{payout.toFixed(2)} USDC</span></div>
              </div>
            )}
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            <button onClick={place} disabled={!sel || placing || (balance != null && stake > balance)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-40">
              {placing ? <><Loader2 className="size-4 animate-spin" /> Placing…</> : `Place ${stake} USDC bet`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
