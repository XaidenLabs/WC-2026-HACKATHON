"use client";

import { useState } from "react";
import useSWR from "swr";
import { ShieldCheck, ExternalLink, TrendingUp, TrendingDown, Ban } from "lucide-react";
import { cn, fetcher } from "@/lib/ui";
import { oddsLabel, selectionShort, sideVerb } from "@/lib/agent/humanize";

type CallStatus = "won" | "lost" | "pending";
export type LedgerRecord = { won: number; lost: number; pending: number; passed?: number };
export type LedgerMetrics = {
  startingBankroll: number; bankroll: number; netPnl: number; staked: number;
  roi: number; hitRate: number; settled: number; equity: { i: number; bankroll: number }[];
};
export type LedgerCall = {
  strategy: string; match: string; side: "back" | "lay"; selection: "home" | "draw" | "away";
  odds: number; reasoning: string; status: CallStatus; finalScore: string | null;
  pnl: number | null; stake: number; timestamp: number; signature: string; explorerUrl: string; fixtureId?: number | null;
};
export type LedgerPass = {
  strategy: string; match: string; reason: string; fixtureId: number;
  timestamp: number; signature: string; explorerUrl: string;
};

type LedgerResp = { ok: boolean; calls: LedgerCall[]; passes?: LedgerPass[]; record?: LedgerRecord; metrics?: LedgerMetrics | null };

/** ORA's verifiable on-chain track record. Global by default; pass `fixtureId` to scope to one match. */
export default function AgentLedger({ fixtureId, refreshMs = 20_000, limit }: { fixtureId?: number; refreshMs?: number; limit?: number }) {
  const [view, setView] = useState<"all" | "calls" | "passes" | "won" | "lost" | "pending">("all");
  const key = fixtureId ? `/api/agent/ledger?fixtureId=${fixtureId}` : "/api/agent/ledger";
  const { data } = useSWR<LedgerResp>(key, fetcher, { refreshInterval: refreshMs });
  const calls = uniqueBySignature(data?.calls ?? []);
  const callSignatures = new Set(calls.map((call) => call.signature));
  const passes = uniqueBySignature(data?.passes ?? []).filter((pass) => !callSignatures.has(pass.signature));
  const record = data?.record;
  const allEvents = [
    ...calls.map((call) => ({ kind: "call" as const, timestamp: call.timestamp, call })),
    ...passes.map((pass) => ({ kind: "pass" as const, timestamp: pass.timestamp, pass })),
  ].sort((a, b) => b.timestamp - a.timestamp);
  const filteredEvents = allEvents.filter((event) => {
    if (view === "all") return true;
    if (view === "calls") return event.kind === "call";
    if (view === "passes") return event.kind === "pass";
    return event.kind === "call" && event.call.status === view;
  });
  const events = limit == null ? filteredEvents : filteredEvents.slice(0, limit);

  return (
    <div>
      <DecisionAudit record={record} total={allEvents.length} />
      {limit == null && allEvents.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto" aria-label="Filter public decisions">
          {(["all", "calls", "passes", "won", "lost", "pending"] as const).map((option) => (
            <button key={option} onClick={() => setView(option)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider",
                view === option ? "border-emerald-500 bg-emerald-500 text-black" : "border-white/10 text-gray-500 hover:text-white",
              )}>
              {option}
            </button>
          ))}
        </div>
      )}
      {allEvents.length === 0 ? (
        <div className="mt-4 flex h-28 items-center justify-center rounded-lg border border-dashed border-white/10 px-4 text-center text-xs text-gray-600">
          {fixtureId ? "ORA has no saved decision for this match yet." : "No ORA decisions yet. Run a scan to create the first one."}
        </div>
      ) : events.length === 0 ? (
        <div className="mt-4 flex h-20 items-center justify-center rounded-lg border border-dashed border-white/10 px-4 text-center text-xs text-gray-600">
          No decisions match this filter.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {events.map((event) => event.kind === "call"
            ? <LedgerCard key={event.call.signature} c={event.call} />
            : <PassCard key={event.pass.signature} p={event.pass} />)}
        </div>
      )}
    </div>
  );
}

function uniqueBySignature<T extends { signature: string }>(items: T[]): T[] {
  const unique = new Map<string, T>();
  for (const item of items) {
    const signature = item.signature.trim();
    if (!signature || unique.has(signature)) continue;
    unique.set(signature, item);
  }
  return [...unique.values()];
}

function DecisionAudit({ record, total }: { record?: LedgerRecord; total: number }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-gray-500">ORA track record</p>
          <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-white">{total} <span className="text-xs font-normal text-gray-500">saved decisions</span></p>
          <p className="text-[10px] text-gray-500">This is a transparent record, not a promise of future performance.</p>
          {(record?.won ?? 0) + (record?.lost ?? 0) < 30 && (
            <p className="mt-1 text-[9px] font-medium text-yellow-500/70">Small sample · do not treat this record as proven performance.</p>
          )}
        </div>
        <div className="space-y-0.5 text-left font-mono text-[10px] text-gray-500 sm:text-right">
          <p>
            <span className="font-bold text-emerald-400">{record?.won ?? 0}W</span> ·{" "}
            <span className="font-bold text-red-400">{record?.lost ?? 0}L</span>
            {record?.pending ? ` · ${record.pending} open` : ""}
          </p>
          <p>{record?.passed ?? 0} passed · every decision is saved</p>
        </div>
      </div>
    </div>
  );
}

function PassCard({ p }: { p: LedgerPass }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0d0d] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold text-white">{p.match}</span>
        <span className="flex shrink-0 items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-gray-400">
          <Ban className="size-2.5" /> PASSED
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-400">ORA stood aside: {p.reason}.</p>
      <div className="mt-2 flex items-center justify-between text-[9px]">
        <span className="flex items-center gap-1 text-gray-500">
          <ShieldCheck className="size-2.5 text-emerald-500" /> {p.strategy}
        </span>
        <a href={p.explorerUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-gray-500 transition-colors hover:text-emerald-400">
          View proof <ExternalLink className="size-2.5" />
        </a>
      </div>
    </div>
  );
}

function StatusChip({ status, score }: { status: CallStatus; score: string | null }) {
  if (status === "won")
    return <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">✓ WON{score ? ` ${score}` : ""}</span>;
  if (status === "lost")
    return <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400">✗ LOST{score ? ` ${score}` : ""}</span>;
  return <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">◷ PENDING</span>;
}

function LedgerCard({ c }: { c: LedgerCall }) {
  const won = c.status === "won";
  const lost = c.status === "lost";
  return (
    <div className={cn("rounded-lg border p-3",
      won ? "border-emerald-500/30 bg-emerald-500/[0.04]" : lost ? "border-red-500/30 bg-red-500/[0.04]" : "border-white/10 bg-[#0d0d0d]")}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold text-white">{c.match}</span>
        <StatusChip status={c.status} score={c.finalScore} />
      </div>
      <p className="mt-1 text-[11px] font-medium text-emerald-400">
        {sideVerb(c.side)} {selectionShort(c.selection)} · pays {oddsLabel(c.odds)}
      </p>
      <p className="mt-1 text-[11px] italic leading-relaxed text-gray-400">“{c.reasoning}”</p>
      <div className="mt-2 flex items-center justify-between text-[9px]">
        <span className="flex items-center gap-1 text-gray-500">
          <ShieldCheck className="size-2.5 text-emerald-500" /> {c.strategy}
        </span>
        <a href={c.explorerUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-gray-500 transition-colors hover:text-emerald-400">
          View proof <ExternalLink className="size-2.5" />
        </a>
      </div>
      {c.fixtureId != null && (
        <a href={`/market/${c.fixtureId}`} className="mt-2 inline-flex text-[9px] text-gray-500 hover:text-emerald-400">
          View game →
        </a>
      )}
    </div>
  );
}

/** Small inline stat used by the backtest view too. */
export function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "up" | "down" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black p-3">
      <p className="text-[9px] uppercase tracking-wider text-gray-600">{label}</p>
      <p className={cn("mt-1 flex items-center gap-1 text-lg font-bold tabular-nums",
        accent === "up" ? "text-emerald-400" : accent === "down" ? "text-red-400" : "text-white")}>
        {accent === "up" && <TrendingUp className="size-3.5" />}
        {accent === "down" && <TrendingDown className="size-3.5" />}
        {value}
      </p>
      {sub && <p className="text-[9px] text-gray-600">{sub}</p>}
    </div>
  );
}
