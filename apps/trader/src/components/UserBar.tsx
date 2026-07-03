"use client";

import { useState } from "react";
import { Wallet, LogOut, X } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useTraderWallet, type Position } from "@/hooks/useTraderWallet";

function cn(...i: ClassValue[]) {
  return twMerge(clsx(i));
}
const SEL: Record<string, string> = { home: "Home", draw: "Draw", away: "Away" };

export default function UserBar() {
  const { ready, authenticated, login, wallet } = useTraderWallet();
  const [open, setOpen] = useState(false);

  if (!ready) return <div className="h-7 w-24 animate-pulse rounded bg-white/5" />;
  if (!authenticated) {
    return (
      <button onClick={login} className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400">
        Sign in to trade
      </button>
    );
  }

  const bal = wallet?.balance;
  const pnl = wallet?.netPnl ?? 0;
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs hover:bg-emerald-500/15">
        <Wallet className="size-3.5 text-emerald-400" />
        <span className="font-bold text-white">{bal != null ? bal.toFixed(2) : "…"} <span className="font-normal text-gray-500">USDC</span></span>
        {wallet && wallet.settled > 0 && (
          <span className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>{pnl >= 0 ? "+" : ""}{pnl}</span>
        )}
      </button>
      {open && <PositionsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function PositionsModal({ onClose }: { onClose: () => void }) {
  const { wallet, email, logout } = useTraderWallet();
  const positions = wallet?.positions ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-16 font-mono" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a0a0a] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">My paper wallet</p>
            <p className="text-2xl font-bold text-white">
              {wallet ? wallet.balance.toFixed(2) : "…"} <span className="text-xs font-normal text-gray-500">USDC</span>
            </p>
            <p className="mt-0.5 text-[10px] text-gray-500">
              {email}
              {wallet ? ` · ${wallet.wins}W / ${wallet.settled} settled · ${wallet.open} open` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="size-4" /></button>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {positions.length === 0 && (
            <p className="py-8 text-center text-xs text-gray-600">No trades yet — tap any market to place your first.</p>
          )}
          {positions.map((p) => <PositionRow key={p.id} p={p} />)}
        </div>

        <button onClick={logout} className="mt-4 flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-white">
          <LogOut className="size-3" /> Sign out
        </button>
      </div>
    </div>
  );
}

function PositionRow({ p }: { p: Position }) {
  const won = p.status === "won";
  const lost = p.status === "lost";
  return (
    <div className={cn("rounded-lg border p-3 text-xs",
      won ? "border-emerald-500/30 bg-emerald-500/5" : lost ? "border-red-500/30 bg-red-500/5" : "border-white/10 bg-black")}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-bold text-white">{p.match}</span>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold",
          won ? "bg-emerald-500/15 text-emerald-400" : lost ? "bg-red-500/15 text-red-400" : "bg-white/5 text-gray-500")}>
          {won ? `WON ${p.finalScore ?? ""}` : lost ? `LOST ${p.finalScore ?? ""}` : "OPEN"}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-gray-400">
        <span>{SEL[p.selection]} @ {p.odds.toFixed(2)}× · {p.stake} USDC</span>
        {p.pnl != null && <span className={cn("font-bold", p.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>{p.pnl >= 0 ? "+" : ""}{p.pnl}</span>}
      </div>
    </div>
  );
}
