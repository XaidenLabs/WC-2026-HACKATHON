"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, TrendingUp, TrendingDown, Loader2, Brain, Check, Lock, ShieldCheck } from "lucide-react";
import MatchChart, { type Candle } from "@/components/MatchChart";
import BetModal from "@/components/BetModal";
import TraderShell from "@/components/TraderShell";
import { cn, fetcher } from "@/lib/ui";
import { oraBttsPick, oraGoalsPick, oraPick, payoutOn, type BttsOdds, type OraBttsModel, type OraGoalsModel, type OraModel1X2, type OuOdds } from "@/lib/ora/pick";
import { useBackBet } from "@/hooks/useBackBet";
import type { MarketScore } from "@/lib/market-data/types";
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
  const { data: oddsData } = useSWR<{ ok: boolean; odds?: Record<Sel, { dec: number; pct: number | null }>; model?: OraModel1X2; ou?: OuOdds; goalsModel?: OraGoalsModel; goalModels?: Array<NonNullable<OraGoalsModel>>; goalMarkets?: Array<{ odds: NonNullable<OuOdds>; model: NonNullable<OraGoalsModel> }>; btts?: BttsOdds; bttsModel?: OraBttsModel; bookmaker?: { name: string } | null; updatedAt?: string }>(
    Number.isFinite(fixtureId) ? `/api/markets/odds?fixtureId=${fixtureId}` : null, fetcher,
    { refreshInterval: 30_000 },
  );
  const { data: scoreData } = useSWR<{ ok: boolean; score: MarketScore | null }>(
    Number.isFinite(fixtureId) ? `/api/markets/scores/${fixtureId}` : null, fetcher, { refreshInterval: 30_000 },
  );
  const { data: analysisData } = useSWR<{
    ok: boolean;
    forecast?: { selectionLabel: string; marketLabel: string; probabilityPct: number };
    analysis?: { source: "llm" | "deterministic_fallback"; summary: string; supportingFactors: string[]; riskFactors: string[]; limitations: string[] };
  }>(Number.isFinite(fixtureId) ? `/api/ora/analysis?fixtureId=${fixtureId}` : null, fetcher, { revalidateOnFocus: false });

  const p1 = chart?.p1 ?? "Home";
  const p2 = chart?.p2 ?? "Away";
  const odds = oddsData?.odds;
  const score = scoreData?.score ?? null;
  const change = chart?.changePct ?? null;
  const up = (change ?? 0) >= 0;

  // ORA's one-tap call for this match, from the live odds.
  const { back, pendingId, authenticated } = useBackBet();
  const pick = oraPick(odds ?? null, oddsData?.model ?? null);
  const pickTeam = pick ? (pick.selection === "home" ? p1 : pick.selection === "away" ? p2 : "the Draw") : null;
  const goalsPicks = (oddsData?.goalMarkets ?? []).flatMap((market) => {
    const next = oraGoalsPick(market.odds, market.model);
    return next ? [next] : [];
  });
  const bttsPick = oraBttsPick(oddsData?.btts ?? null, oddsData?.bttsModel ?? null);
  const backing = pendingId === fixtureId;
  const forecastCandidates = [
    ...(oddsData?.model ? [
      { label: p1, market: "Match winner", probability: oddsData.model.home },
      { label: "Draw", market: "Match winner", probability: oddsData.model.draw },
      { label: p2, market: "Match winner", probability: oddsData.model.away },
    ] : []),
    ...(oddsData?.goalModels ?? []).flatMap((model) => [
      { label: `Over ${model.line}`, market: `Total goals ${model.line}`, probability: model.over },
      { label: `Under ${model.line}`, market: `Total goals ${model.line}`, probability: model.under },
    ]),
    ...(oddsData?.bttsModel ? [
      { label: "BTTS Yes", market: "Both teams to score", probability: oddsData.bttsModel.yes },
      { label: "BTTS No", market: "Both teams to score", probability: oddsData.bttsModel.no },
    ] : []),
  ].filter((candidate) => Number.isFinite(candidate.probability))
    .toSorted((a, b) => Math.abs(a.probability - 75) - Math.abs(b.probability - 75));
  const bestForecast = analysisData?.forecast
    ? { label: analysisData.forecast.selectionLabel, market: analysisData.forecast.marketLabel, probability: analysisData.forecast.probabilityPct }
    : forecastCandidates[0] ?? null;

  const legs: { sel: Sel; label: string }[] = [
    { sel: "home", label: p1 },
    { sel: "draw", label: "Draw" },
    { sel: "away", label: p2 },
  ];

  const oraRead = (() => {
    if (change == null) return "ORA is watching the market open up...";
    const who = sel === "draw" ? "the draw" : sel === "home" ? p1 : p2;
    if (Math.abs(change) < 1.5) return `${who}'s price is holding steady · the market hasn't picked a side yet.`;
    return up
      ? `Money is flowing into ${who} · its win-chance has climbed ${Math.abs(change)}% this window. Momentum is building.`
      : `${who} is drifting · its win-chance has slid ${Math.abs(change)}% this window. The market is cooling on them.`;
  })();

  return (
    <TraderShell title="Game desk" subtitle={p1 !== "Home" ? `${p1} v ${p2}` : "Live odds, scores, and ORA analysis."}>
      <div className="terminal-workspace mx-auto w-full max-w-4xl font-mono">
        <Link href="/markets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#686a64] hover:text-[#efefeb]">
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
              <p className="font-mono text-2xl font-bold text-white">{score.home}-{score.away}</p>
              <p className="text-[10px] text-emerald-400">
                {score.isFinished ? "FULL TIME" : score.isLive ? (score.minutes != null ? `${score.minutes}' LIVE` : "LIVE") : score.state}
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
                <p className={cn("truncate text-[10px]", active ? "text-[#2b170c]" : "text-gray-400")}>{l.sel === "draw" ? "Draw" : l.label}</p>
                <p className={cn("text-lg font-bold", active ? "text-[#0a0b09]" : "text-white")}>{leg?.pct != null ? `${Math.round(leg.pct)}%` : "·"}</p>
                <p className={cn("text-[10px]", active ? "text-[#3d210f]" : "text-gray-500")}>{leg?.dec ? `${leg.dec.toFixed(2)}×` : ""}</p>
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

        {bestForecast && (
          <div className="mt-3 rounded-xl border border-orange-500/30 bg-orange-500/[0.05] p-4">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-orange-400">
              <Brain className="size-3.5" /> Best model forecast · {bestForecast.market}
            </p>
            <p className="mt-1 text-base text-gray-200">
              <span className="font-bold text-white">{bestForecast.label}</span> at {Math.round(bestForecast.probability * 10) / 10}% model probability
            </p>
            <p className="mt-1 text-[11px] leading-snug text-gray-500">
              This is ORA&apos;s strongest available forecast for the game. It becomes a trade only when a live executable price produces positive expected value and passes the safety checks.
            </p>
            {analysisData?.analysis && (
              <div className="mt-3 border-t border-orange-500/15 pt-3">
                <p className="text-xs leading-relaxed text-gray-300">{analysisData.analysis.summary}</p>
                <div className="mt-2 grid gap-3 text-[11px] sm:grid-cols-2">
                  <div>
                    <p className="uppercase tracking-wider text-emerald-400">Evidence</p>
                    {analysisData.analysis.supportingFactors.map((factor) => <p key={factor} className="mt-1 text-gray-500">+ {factor}</p>)}
                  </div>
                  <div>
                    <p className="uppercase tracking-wider text-yellow-500">Risks and limits</p>
                    {[...analysisData.analysis.riskFactors, ...analysisData.analysis.limitations].slice(0, 4).map((risk) => <p key={risk} className="mt-1 text-gray-500">· {risk}</p>)}
                  </div>
                </div>
                <p className="mt-2 text-[9px] uppercase tracking-wider text-gray-600">Coach: {analysisData.analysis.source === "llm" ? "LLM constrained by live evidence" : "deterministic fallback"}</p>
              </div>
            )}
          </div>
        )}

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
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => back({ fixtureId, match: `${p1} v ${p2}`, selection: pick.selection, odds: pick.dec })}
                    disabled={backing}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60">
                    {backing ? <><Loader2 className="size-4 animate-spin" /> Backing…</>
                      : !authenticated ? <><Lock className="size-3.5" /> Sign in to save sandbox read</>
                      : <><Check className="size-4" /> Save research read</>}
                  </button>
                  <div className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/10 py-3 text-center text-xs font-bold text-gray-500">
                    <ShieldCheck className="size-4" /> TxLINE proof mapping required for escrow
                  </div>
                </div>
                <p className="mt-2 text-center text-[10px] text-gray-500">Sandbox saves research only. Devnet escrow stays disabled until this Sportmonks fixture is mapped to a TxLINE proof fixture.</p>
              </>
            ) : (
              <p className="mt-3 rounded-lg border border-white/10 py-2.5 text-center text-xs text-gray-500">ORA stands aside on the match winner</p>
            )}
          </div>
        )}

        {/* ORA prices each totals line independently. */}
        {goalsPicks.map((goalsPick) => (
          <div key={goalsPick.line} className={cn("mt-2 rounded-xl border p-4", goalsPick.value ? "border-sky-500/30 bg-sky-500/[0.05]" : "border-white/10 bg-[#0a0a0a]")}>
            <div className="flex items-center justify-between">
              <p className={cn("flex items-center gap-1.5 text-[10px] uppercase tracking-wider", goalsPick.value ? "text-sky-400" : "text-gray-500")}>
                <Brain className="size-3.5" /> Total goals {goalsPick.line} · {goalsPick.confidence}
              </p>
              <span className="font-mono text-[10px] text-gray-500">EV {goalsPick.evPct >= 0 ? "+" : ""}{goalsPick.evPct}%</span>
            </div>
            <p className="mt-1 text-sm text-gray-200">{goalsPick.value ? <>ORA backs <span className="font-bold text-white">{goalsPick.label}</span> at {goalsPick.dec.toFixed(2)}×.</> : `ORA passes the ${goalsPick.line} goals line.`}</p>
            <p className="mt-1 text-[11px] italic leading-snug text-gray-500">{goalsPick.reasoning}</p>
            {goalsPick.value && <button
              onClick={() => back({ fixtureId, match: `${p1} v ${p2}`, selection: goalsPick.selection, odds: goalsPick.dec, market: "goals_ou", line: goalsPick.line })}
              disabled={backing}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 py-3 text-sm font-bold text-black hover:bg-sky-400 disabled:opacity-60">
              {backing ? <><Loader2 className="size-4 animate-spin" /> Backing…</>
                : !authenticated ? <><Lock className="size-3.5" /> Sign in to back</>
                : <><Check className="size-4" /> Back {goalsPick.label} · 50 USDC → win {payoutOn(50, goalsPick.dec)}</>}
            </button>}
          </div>
        ))}

        {bttsPick && (
          <div className={cn("mt-2 rounded-xl border p-4", bttsPick.value ? "border-orange-500/30 bg-orange-500/[0.05]" : "border-white/10 bg-[#0a0a0a]")}>
            <div className="flex items-center justify-between">
              <p className={cn("flex items-center gap-1.5 text-[10px] uppercase tracking-wider", bttsPick.value ? "text-orange-400" : "text-gray-500")}>
                <Brain className="size-3.5" /> Both teams to score · {bttsPick.confidence}
              </p>
              <span className="font-mono text-[10px] text-gray-500">EV {bttsPick.evPct >= 0 ? "+" : ""}{bttsPick.evPct}%</span>
            </div>
            <p className="mt-1 text-sm text-gray-200">{bttsPick.value ? <>ORA backs <span className="font-bold text-white">{bttsPick.label}</span> at {bttsPick.dec.toFixed(2)}×.</> : "ORA passes the BTTS market."}</p>
            <p className="mt-1 text-[11px] italic leading-snug text-gray-500">{bttsPick.reasoning}</p>
            {bttsPick.value && <button
              onClick={() => back({ fixtureId, match: `${p1} v ${p2}`, selection: bttsPick.selection, odds: bttsPick.dec, market: "btts" })}
              disabled={backing}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-3 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-60">
              {backing ? <><Loader2 className="size-4 animate-spin" /> Backing…</>
                : !authenticated ? <><Lock className="size-3.5" /> Sign in to back</>
                : <><Check className="size-4" /> Back {bttsPick.label} · 50 USDC → win {payoutOn(50, bttsPick.dec)}</>}
            </button>}
          </div>
        )}

        {/* Pick your own side (secondary) */}
        <button onClick={() => setBetOpen(true)}
          className="mt-2 w-full rounded-lg border border-white/10 py-2.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/5">
          Or pick your own 1X2 side →
        </button>
        <p className="mt-2 text-center text-[10px] text-gray-600">
          Sportmonks prices the market. TxLINE remains the planned proof layer for verifiable settlement.
        </p>
      </div>

      {betOpen && (
        <BetModal fixture={{ FixtureId: fixtureId, Participant1: p1, Participant2: p2 }} onClose={() => setBetOpen(false)} />
      )}
    </TraderShell>
  );
}
