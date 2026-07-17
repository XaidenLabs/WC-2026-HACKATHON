"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Wallet } from "lucide-react";
import Header from "@/components/Header";
import { cn } from "@/lib/ui";
import { useTraderWallet, type Position } from "@/hooks/useTraderWallet";

const SEL: Record<string, string> = { home: "Home", draw: "Draw", away: "Away" };

// My predictions — every live-data sandbox position the signed-in user has placed, each linking to its own
// shareable prediction page.
export default function Portfolio() {
  const { ready, authenticated, login, wallet, email } = useTraderWallet();
  const positions = wallet?.positions ?? [];

  return (
    <div className="min-h-screen bg-[#050505] font-mono text-gray-300">
      <Header tagline="my predictions" />
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white">
          <ArrowLeft className="size-4" /> Home
        </Link>

        {ready && !authenticated ? (
          <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-8 text-center">
            <Wallet className="mx-auto size-6 text-emerald-400" />
            <p className="mt-3 text-sm text-gray-400">Sign in to see your live-data sandbox positions and 1,000 test USDC.</p>
            <button onClick={login} className="mt-4 rounded-md bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400">
              Sign in with email
            </button>
          </div>
        ) : (
          <>
            {/* Wallet summary */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Live-data sandbox</p>
              <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums text-white">
                {wallet ? wallet.balance.toFixed(2) : "…"} <span className="text-sm font-normal text-gray-500">USDC</span>
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                {email}
                {wallet ? ` · ${wallet.wins}W / ${wallet.settled} settled · ${wallet.open} open · ` : " · "}
                {wallet && <span className={wallet.netPnl >= 0 ? "text-emerald-400" : "text-red-400"}>{wallet.netPnl >= 0 ? "+" : ""}{wallet.netPnl} P&amp;L</span>}
              </p>
            </div>

            <h2 className="mb-3 mt-6 text-[10px] uppercase tracking-wider text-gray-500">Predictions</h2>
            {positions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-600">
                No predictions yet · <Link href="/#markets" className="text-emerald-400 hover:underline">open a market</Link> to place your first.
              </div>
            ) : (
              <div className="space-y-2">
                {positions.map((p) => <PositionCard key={p.id} p={p} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PositionCard({ p }: { p: Position }) {
  const won = p.status === "won";
  const lost = p.status === "lost";
  return (
    <Link href={`/prediction/${p.id}`}
      className={cn("flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:border-emerald-500/40",
        won ? "border-emerald-500/30 bg-emerald-500/[0.04]" : lost ? "border-red-500/30 bg-red-500/[0.04]" : "border-white/10 bg-[#0a0a0a]")}>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{p.match}</p>
        <p className="mt-0.5 text-[11px] text-gray-500">{SEL[p.selection]} @ {p.odds.toFixed(2)}× · {p.stake} USDC</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold",
          won ? "bg-emerald-500/15 text-emerald-400" : lost ? "bg-red-500/15 text-red-400" : "bg-white/5 text-gray-400")}>
          {won ? `WON ${p.finalScore ?? ""}` : lost ? `LOST ${p.finalScore ?? ""}` : "OPEN"}
        </span>
        {p.pnl != null && (
          <span className={cn("font-mono text-sm font-bold", p.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
            {p.pnl >= 0 ? "+" : ""}{p.pnl}
          </span>
        )}
        <ArrowRight className="size-4 text-gray-600" />
      </div>
    </Link>
  );
}
