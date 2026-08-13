"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, ShieldCheck, Share2, Check, TrendingUp, ExternalLink, Loader2, Lock, Copy } from "lucide-react";
import TraderShell from "@/components/TraderShell";
import { cn, fetcher } from "@/lib/ui";
import { payoutOn } from "@/lib/ora/pick";
import { useBackBet } from "@/hooks/useBackBet";

type Bet = {
  id: string; fixture_id: number; match: string;
  market?: "1x2" | "goals_ou"; line?: number | null;
  selection: "home" | "draw" | "away" | "over" | "under";
  odds: number; stake: number; status: "open" | "won" | "lost"; pnl: number | null; created_at: string;
};
type Live = {
  finalScore: string | null; minutes: number | null; clockRunning: boolean; isFinished: boolean;
  currentProb: number | null; currentDec: number | null;
};
type Resp = { ok: boolean; bet?: Bet; live?: Live; error?: string };

export default function PredictionPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useSWR<Resp>(id ? `/api/trader/prediction/${id}` : null, fetcher, { refreshInterval: 30_000 });
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* noop */ }
  };

  const bet = data?.bet;
  const live = data?.live;

  return (
    <TraderShell title="Prediction receipt" subtitle="Verifiable position details and live settlement state.">
      <div className="terminal-workspace mx-auto w-full max-w-xl font-mono">
        <Link href="/portfolio" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#686a64] hover:text-[#efefeb]">
          <ArrowLeft className="size-4" /> My predictions
        </Link>

        {isLoading && !data && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-[#0a0a0a] text-gray-600">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}

        {data && !bet && (
          <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-8 text-center text-sm text-gray-500">
            This prediction couldn&apos;t be found.
          </div>
        )}

        {bet && <Receipt bet={bet} live={live} onShare={share} copied={copied} />}
        {bet && <CopyPrediction bet={bet} live={live} />}
      </div>
    </TraderShell>
  );
}

/** Lets a visitor place the SAME prediction on their own account, at current odds. */
function CopyPrediction({ bet, live }: { bet: Bet; live?: Live }) {
  const { back, pendingId, authenticated } = useBackBet();
  const backing = pendingId === bet.fixture_id;
  const [p1, p2] = bet.match.split(" v ");
  const pickLabel = bet.market === "goals_ou"
    ? `${bet.selection === "over" ? "Over" : "Under"} ${bet.line}`
    : bet.selection === "home" ? p1 : bet.selection === "away" ? p2 : "the Draw";
  const odds = live?.currentDec ?? bet.odds;

  if (live?.isFinished) {
    return <p className="mt-4 text-center text-[11px] text-gray-600">This match has ended · the market is closed.</p>;
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4">
      <p className="text-[10px] uppercase tracking-wider text-emerald-400">Copy this prediction</p>
      <p className="mt-1 text-sm text-gray-200">
        Back <span className="font-bold text-white">{pickLabel}</span> on your own account · at the current {odds.toFixed(2)}× price.
      </p>
      <button
        onClick={() => back({
          fixtureId: bet.fixture_id, match: bet.match, selection: bet.selection, odds,
          market: bet.market ?? "1x2", line: bet.line ?? undefined, stake: 50,
        })}
        disabled={backing}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60">
        {backing ? <><Loader2 className="size-4 animate-spin" /> Backing…</>
          : !authenticated ? <><Lock className="size-3.5" /> Sign in to back this</>
          : <><Copy className="size-4" /> Back the same · 50 USDC → win {payoutOn(50, odds)}</>}
      </button>
    </div>
  );
}

function Receipt({ bet, live, onShare, copied }: { bet: Bet; live?: Live; onShare: () => void; copied: boolean }) {
  const [p1, p2] = bet.match.split(" v ");
  const pickTeam = bet.market === "goals_ou"
    ? `${bet.selection === "over" ? "Over" : "Under"} ${bet.line} goals`
    : bet.selection === "home" ? p1 : bet.selection === "away" ? p2 : "the Draw";
  const entryImplied = Math.round((100 / bet.odds) * 10) / 10;
  const potentialPayout = Math.round(bet.stake * bet.odds * 100) / 100;
  const potentialProfit = Math.round(bet.stake * (bet.odds - 1) * 100) / 100;
  const won = bet.status === "won";
  const lost = bet.status === "lost";
  const open = bet.status === "open";

  const statusBadge = won
    ? { label: `✓ WON${live?.finalScore ? ` ${live.finalScore}` : ""}`, cls: "bg-emerald-500/15 text-emerald-400" }
    : lost
      ? { label: `✗ LOST${live?.finalScore ? ` ${live.finalScore}` : ""}`, cls: "bg-red-500/15 text-red-400" }
      : live?.clockRunning
        ? { label: `● LIVE ${live.minutes ?? 0}'`, cls: "bg-emerald-500/15 text-emerald-400" }
        : { label: "◷ OPEN", cls: "bg-white/5 text-gray-400" };

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-[10px] uppercase tracking-wider text-gray-500">
        <span>Prediction · FX#{bet.fixture_id}</span>
        <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold", statusBadge.cls)}>{statusBadge.label}</span>
      </div>

      <div className="px-5 py-5">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">{p1} v {p2}</p>
        <h1 className="mt-1 font-sans text-xl font-bold text-white">
          Backed <span className="text-emerald-400">{pickTeam}</span> @ {bet.odds.toFixed(2)}×
        </h1>

        {/* Live score */}
        {live?.finalScore && (
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white">{live.finalScore}</span>
            <span className="text-[10px] text-emerald-400">
              {live.isFinished ? "FULL TIME" : live.clockRunning ? `${live.minutes}' LIVE` : ""}
            </span>
          </div>
        )}

        {/* Numbers */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Cell label="STAKE" value={`${bet.stake} USDC`} />
          <Cell label={won ? "PAID OUT" : lost ? "LOST" : "IF IT WINS"}
            value={won ? `+${potentialProfit} USDC` : lost ? `−${bet.stake} USDC` : `${potentialPayout} USDC`}
            accent={won ? "up" : lost ? "down" : undefined} />
          <Cell label="ENTRY CHANCE" value={`${entryImplied}%`} />
          <Cell label="LIVE WIN-CHANCE"
            value={live?.currentProb != null ? `${Math.round(live.currentProb)}%` : "·"}
            hint={live?.currentProb != null && <TrendingUp className="size-3 text-emerald-400" />} />
        </div>

        {/* Settlement / P&L */}
        {!open && bet.pnl != null && (
          <div className={cn("mt-4 flex items-center justify-between rounded-lg border px-4 py-3",
            won ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-red-500/30 bg-red-500/[0.04]")}>
            <span className="text-xs text-gray-400">Result</span>
            <span className={cn("font-mono text-lg font-bold", won ? "text-emerald-400" : "text-red-400")}>
              {bet.pnl >= 0 ? "+" : ""}{bet.pnl} USDC
            </span>
          </div>
        )}
        {open && (
          <p className="mt-4 rounded-lg border border-white/10 bg-black px-4 py-3 text-[11px] text-gray-500">
            Waiting for full time. This settles <span className="text-emerald-400">automatically</span> on the real
            TxLINE result · win-chance above updates live as the match plays.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
        <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <ShieldCheck className="size-3 text-emerald-500" /> settles on the real TxLINE result · no admin
        </span>
        <div className="flex items-center gap-2">
          <Link href={`/market/${bet.fixture_id}`} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-emerald-400">
            watch <ExternalLink className="size-2.5" />
          </Link>
          <button onClick={onShare}
            className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/15">
            {copied ? <><Check className="size-3" /> Copied</> : <><Share2 className="size-3" /> Share</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, accent, hint }: { label: string; value: string; accent?: "up" | "down"; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black p-3">
      <p className="text-[9px] uppercase tracking-wider text-gray-600">{label}</p>
      <p className={cn("mt-0.5 flex items-center gap-1 text-base font-bold tabular-nums",
        accent === "up" ? "text-emerald-400" : accent === "down" ? "text-red-400" : "text-white")}>
        {value}{hint}
      </p>
    </div>
  );
}
