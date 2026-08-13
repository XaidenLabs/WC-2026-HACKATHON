"use client";

import Link from "next/link";
import useSWR from "swr";
import { Brain, Loader2, ArrowRight, Lock, Check } from "lucide-react";
import { cn, fetcher, kickoff } from "@/lib/ui";
import { payoutOn } from "@/lib/ora/pick";
import type { OraForecast, OraOpportunity } from "@/lib/ora/engine-domain";
import type { SupervisedMarket, SupervisedSelection } from "@/lib/supervision/domain";
import { useBackBet } from "@/hooks/useBackBet";

type Pick = {
  fixtureId: number; p1: string; p2: string; competition: string; startTime: number;
  phase: "upcoming" | "live";
  forecast: OraForecast;
  alternatives: OraForecast[];
  trade: OraOpportunity | null;
};

/** ORA's live AI predictions, each backable in one tap. `stake` sets the amount shown/placed. */
export default function OraPicks({ limit, stake = 50 }: { limit?: number; stake?: number }) {
  const { data, error } = useSWR<{ ok: boolean; picks: Pick[]; error?: string }>(
    "/api/ora/picks", fetcher,
    { refreshInterval: 30_000, keepPreviousData: true, errorRetryCount: 10, errorRetryInterval: 3000 },
  );
  const { back, pendingId, authenticated, error: betError } = useBackBet();
  const picks = (data?.picks ?? []).slice(0, limit ?? 20);
  // Only show the error when there is nothing to display. Transient provider blips keep the list.
  const feedError = (Boolean(error) || data?.ok === false) && picks.length === 0;

  return (
    <div className="space-y-2.5">
      {!data && !feedError && (
        <div className="flex h-24 items-center justify-center rounded-xl border border-white/10 bg-[#0a0a0a] text-gray-600">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
      {feedError && picks.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 text-center text-sm text-yellow-500/80">
          Picks unavailable. The football feed may need reconnecting.
        </p>
      )}
      {data && !feedError && picks.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 text-center text-sm text-gray-500">
          No live or upcoming matches to price right now.
        </p>
      )}
      {betError && <p className="text-center text-xs text-red-400">{betError}</p>}
      {picks.map((p) => (
        <PickCard key={p.fixtureId} p={p} stake={stake} onBack={back} pending={pendingId === p.fixtureId} authed={authenticated} />
      ))}
    </div>
  );
}

function PickCard({
  p, stake, onBack, pending, authed,
}: {
  p: Pick;
  stake: number;
  onBack: (i: { fixtureId: number; match: string; selection: SupervisedSelection; odds: number; stake: number; market: SupervisedMarket; line?: number }) => void;
  pending: boolean;
  authed: boolean;
}) {
  const trade = p.trade;
  const forecast = p.forecast;
  const val = Boolean(trade?.pick.value);
  const tierColor =
    trade?.pick.tier === "strong" ? "text-emerald-400"
      : trade?.pick.tier === "value" ? "text-emerald-400"
      : trade?.pick.tier === "slim" ? "text-sky-400" : "text-gray-500";
  const edgeStr = trade ? `${trade.pick.edge >= 0 ? "+" : ""}${trade.pick.edge}pp edge · EV ${trade.pick.evPct >= 0 ? "+" : ""}${trade.pick.evPct}%` : "";
  const payout = trade ? payoutOn(stake, trade.pick.dec) : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#0a0a0a] p-4 transition-colors hover:border-white/20 sm:flex-row sm:items-center sm:justify-between">
      {/* Match + ORA's read */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500">
          <span className="truncate">{p.competition}</span>
          {p.phase === "live"
            ? <span className="flex items-center gap-1 text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE</span>
            : <span className="text-gray-500">{kickoff(p.startTime)}</span>}
        </div>
        <Link href={`/market/${p.fixtureId}`} className="mt-0.5 block truncate text-sm font-bold text-white hover:text-emerald-300">
          {p.p1} <span className="text-gray-600">v</span> {p.p2}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px]">
          <span className="flex items-center gap-1 font-medium text-white">
            <Brain className="size-3.5 text-orange-500" /> Best forecast: {forecast.selectionLabel}
          </span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-400">
            {forecast.probabilityPct}% model
          </span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">{forecast.marketLabel}</span>
          <span className="text-gray-500">{forecast.status === "priced" ? "price available" : "forecast only"}</span>
        </p>
        <p className="mt-1 text-[11px] leading-snug text-gray-500">{forecast.reasoning}</p>
        {p.alternatives.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
            <span>Other model angles:</span>
            {p.alternatives.map((alternative) => (
              <span key={`${alternative.market}:${alternative.line ?? "na"}`} className="rounded border border-white/10 px-1.5 py-0.5">
                {alternative.selectionLabel} {alternative.probabilityPct}%
              </span>
            ))}
          </p>
        )}
        {trade && (
          <p className="mt-1 text-[11px] text-emerald-400">
            Trade-qualified: {trade.selectionLabel} at {trade.pick.dec.toFixed(2)}× · {edgeStr}
          </p>
        )}
      </div>

      {/* One-tap back, or a disciplined pass */}
      <div className="flex shrink-0 items-center gap-2">
        <Link href={`/market/${p.fixtureId}`} className="hidden text-[11px] text-gray-500 hover:text-white sm:flex sm:items-center sm:gap-1">
          chart <ArrowRight className="size-3" />
        </Link>
        {val ? (
          <button
            onClick={() => trade && onBack({ fixtureId: p.fixtureId, match: `${p.p1} v ${p.p2}`, selection: trade.pick.selection, odds: trade.pick.dec, stake, market: trade.market, ...(trade.line != null ? { line: trade.line } : {}) })}
            disabled={pending}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-emerald-400 disabled:opacity-60">
            {pending ? <><Loader2 className="size-4 animate-spin" /> Backing…</>
              : !authed ? <><Lock className="size-3.5" /> Sign in to back</>
              : <><Check className="size-4" /> Back {stake} → win {payout}</>}
          </button>
        ) : (
          <span className={cn("rounded-lg border border-white/10 px-4 py-2.5 text-xs font-medium", tierColor)}>
            Forecast only · no qualified edge
          </span>
        )}
      </div>
    </div>
  );
}
