"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, TrendingUp, TrendingDown, Loader2, Brain, Check, Lock } from "lucide-react";
import MatchChart, { type Candle } from "@/components/MatchChart";
import BetModal from "@/components/BetModal";
import Header from "@/components/Header";
import { cn, fetcher } from "@/lib/ui";
import { oraPick, oraGoalsPick, payoutOn, type OuOdds } from "@/lib/ora/pick";
import { useBackBet } from "@/hooks/useBackBet";
import { parseCurrentScore, type TxScoreEvent } from "@/lib/txline/types";
type Sel = "home" | "draw" | "away";

type ChartResp = {
  ok: boolean;
  candles: Candle[];
  p1: string;
  p2: string;
  competition: string;
  current: { prob: number; dec: number } | null;
  changePct: number | null;
};

export default function MarketPage() {
  const { id } = useParams<{ id: string }>();
  const fixtureId = Number(id);
  const [sel, setSel] = useState<Sel>("home");
  const [betOpen, setBetOpen] = useState(false);

  const { data: chart, isLoading } = useSWR<ChartResp>(
    Number.isFinite(fixtureId) ? `/api/agent/chart?fixtureId=${fixtureId}&sel=${sel}` : null,
    fetcher, { revalidateOnFocus: false, refreshInterval: 30_000, keepPreviousData: true },
  );
  const { data: oddsData } = useSWR<{ ok: boolean; odds?: Record<Sel, { dec: number; pct: number | null }>; ou?: OuOdds }>(
    Number.isFinite(fixtureId) ? `/api/txline/odds?fixtureId=${fixtureId}` : null, fetcher,
    { refreshInterval: 30_000 },
  );
  const { data: scoreData } = useSWR<{ ok: boolean; scores: TxScoreEvent[] }>(
    Number.isFinite(fixtureId) ? `/api/txline/scores/${fixtureId}` : null, fetcher, { refreshInterval: 30_000 },
  );

  const p1 = chart?.p1 ?? "Home";
  const p2 = chart?.p2 ?? "Away";
  const odds = oddsData?.odds;
  const score = scoreData?.scores ? parseCurrentScore(scoreData.scores) : null;
  const change = chart?.changePct ?? null;
  const up = (change ?? 0) >= 0;

  // ORA's one-tap call for this match, from the live odds.
  const { back, pendingId, authenticated } = useBackBet();
  const pick = oraPick(odds ?? null);
  const pickTeam = pick ? (pick.selection === "home" ? p1 : pick.selection === "away" ? p2 : "the Draw") : null;
  const goalsPick = oraGoalsPick(oddsData?.ou ?? null);
  const backing = pendingId === fixtureId;

  const legs: { sel: Sel; label: string }[] = [
    { sel: "home", label: p1 },
    { sel: "draw", label: "Draw" },
    { sel: "away", label: p2 },
  ];

  const oraRead = (() => {
    if (change == null) return "ORA is watching the market open up…";
    const who = sel === "draw" ? "the draw" : sel === "home" ? p1 : p2;
    if (Math.abs(change) < 1.5) return `${who}'s price is holding steady · the market hasn't picked a side yet.`;
    return up
      ? `Money is flowing into ${who} · its win-chance has climbed ${Math.abs(change)}% this window. Momentum is building.`
      : `${who} is drifting · its win-chance has slid ${Math.abs(change)}% this window. The market is cooling on them.`;
  })();

  return (
    <div className="min-h-screen bg-[#050505] font-mono text-gray-300">
      <Header tagline={p1 !== "Home" ? `${p1} v ${p2}` : "match desk"} />
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white">
          <ArrowLeft className="size-4" /> All markets
        </Link>

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-600">{chart?.competition ?? "World Cup"}</p>
            <h1 className="text-xl font-bold text-white">{p1} <span className="text-gray-600">v</span> {p2}</h1>
          </div>
          {score && (
            <div className="text-right">
              <p className="font-mono text-2xl font-bold text-white">{score.p1Goals}–{score.p2Goals}</p>
              <p className="text-[10px] text-emerald-400">
                {score.isFinished ? "FULL TIME" : score.clockRunning ? `${score.minutes}' LIVE` : "·"}
              </p>
            </div>
          )}
        </div>

        {/* Outcome tabs = the tradeable "assets" */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {legs.map((l) => {
            const leg = odds?.[l.sel];
            const active = sel === l.sel;
            return (
              <button key={l.sel} onClick={() => setSel(l.sel)}
                className={cn("rounded-lg border p-3 text-left transition-colors",
                  active ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 bg-[#0a0a0a] hover:border-white/20")}>
                <p className="truncate text-[10px] text-gray-400">{l.sel === "draw" ? "Draw" : l.label}</p>
                <p className="text-lg font-bold text-white">{leg?.pct != null ? `${Math.round(leg.pct)}%` : "·"}</p>
                <p className="text-[10px] text-gray-500">{leg?.dec ? `${leg.dec.toFixed(2)}×` : ""}</p>
              </button>
            );
          })}
        </div>

        {/* Price + candlestick chart */}
        <div className="mt-3 rounded-xl border border-white/10 bg-[#0a0a0a] p-3">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                {sel === "draw" ? "Draw" : sel === "home" ? p1 : p2} · win-probability
              </p>
              <p className="text-2xl font-bold text-white">
                {chart?.current ? `${chart.current.prob}%` : "·"}
                {change != null && (
                  <span className={cn("ml-2 inline-flex items-center gap-1 text-sm font-bold", up ? "text-emerald-400" : "text-red-400")}>
                    {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                    {up ? "+" : ""}{change}%
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="h-72 w-full">
            {isLoading && !chart ? (
              <div className="flex h-full items-center justify-center text-gray-600"><Loader2 className="size-5 animate-spin" /></div>
            ) : chart?.candles && chart.candles.length > 1 ? (
              <MatchChart candles={chart.candles} />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs text-gray-600">
                Not enough price history for this market yet.
              </div>
            )}
          </div>
        </div>

        {/* ORA reads the market */}
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-400">
            <Brain className="size-3" /> ORA reads the market
          </p>
          <p className="text-sm leading-relaxed text-gray-300">{oraRead}</p>
        </div>

        {/* ORA's match-winner call — model read + one-tap back (or a disciplined pass) */}
        {pick && pickTeam && (
          <div className={cn("mt-3 rounded-xl border p-4", pick.value ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-white/10 bg-[#0a0a0a]")}>
            <div className="flex items-center justify-between">
              <p className={cn("flex items-center gap-1.5 text-[10px] uppercase tracking-wider", pick.value ? "text-emerald-400" : "text-gray-400")}>
                <Brain className="size-3.5" /> ORA&apos;s call · {pick.confidence}
              </p>
              {pick.value && (
                <span className="font-mono text-[10px] text-gray-500">model {pick.prob}% vs market {pick.marketProb}% · EV {pick.evPct >= 0 ? "+" : ""}{pick.evPct}%</span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-200">
              {pick.value ? <>ORA backs <span className="font-bold text-white">{pickTeam}</span> at {pick.dec.toFixed(2)}×, a +{pick.edge}pp edge on the market.</> : "ORA sees no value here."}
            </p>
            <p className="mt-1 text-[11px] italic leading-snug text-gray-500">{pick.reasoning}</p>
            {pick.value ? (
              <button
                onClick={() => back({ fixtureId, match: `${p1} v ${p2}`, selection: pick.selection, odds: pick.dec })}
                disabled={backing}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60">
                {backing ? <><Loader2 className="size-4 animate-spin" /> Backing…</>
                  : !authenticated ? <><Lock className="size-3.5" /> Sign in to back ORA</>
                  : <><Check className="size-4" /> Back ORA · 50 USDC → win {payoutOn(50, pick.dec)}</>}
              </button>
            ) : (
              <p className="mt-3 rounded-lg border border-white/10 py-2.5 text-center text-xs text-gray-500">ORA stands aside on the match winner</p>
            )}
          </div>
        )}

        {/* ORA's goals call — Over/Under */}
        {goalsPick && goalsPick.value && (
          <div className="mt-2 rounded-xl border border-sky-500/30 bg-sky-500/[0.05] p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-sky-400">
                <Brain className="size-3.5" /> Goals · {goalsPick.confidence}
              </p>
              <span className="font-mono text-[10px] text-gray-500">EV {goalsPick.evPct >= 0 ? "+" : ""}{goalsPick.evPct}%</span>
            </div>
            <p className="mt-1 text-sm text-gray-200">
              ORA backs <span className="font-bold text-white">{goalsPick.label} goals</span> at {goalsPick.dec.toFixed(2)}×.
            </p>
            <p className="mt-1 text-[11px] italic leading-snug text-gray-500">{goalsPick.reasoning}</p>
            <button
              onClick={() => back({ fixtureId, match: `${p1} v ${p2}`, selection: goalsPick.selection, odds: goalsPick.dec, market: "goals_ou", line: goalsPick.line })}
              disabled={backing}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 py-3 text-sm font-bold text-black hover:bg-sky-400 disabled:opacity-60">
              {backing ? <><Loader2 className="size-4 animate-spin" /> Backing…</>
                : !authenticated ? <><Lock className="size-3.5" /> Sign in to back</>
                : <><Check className="size-4" /> Back {goalsPick.label} · 50 USDC → win {payoutOn(50, goalsPick.dec)}</>}
            </button>
          </div>
        )}

        {/* Pick your own side (secondary) */}
        <button onClick={() => setBetOpen(true)}
          className="mt-2 w-full rounded-lg border border-white/10 py-2.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/5">
          Or pick your own 1X2 side →
        </button>
        <p className="mt-2 text-center text-[10px] text-gray-600">
          Settles automatically on the real result · every prediction gets its own shareable page.
        </p>
      </div>

      {betOpen && (
        <BetModal fixture={{ FixtureId: fixtureId, Participant1: p1, Participant2: p2 }} onClose={() => setBetOpen(false)} />
      )}
    </div>
  );
}
