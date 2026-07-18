"use client";

import useSWR from "swr";
import { ShieldCheck, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { cn, fetcher } from "@/lib/ui";
import { oddsLabel, selectionShort, sideVerb } from "@/lib/agent/humanize";

type CallStatus = "won" | "lost" | "pending";
export type LedgerRecord = { won: number; lost: number; pending: number };
export type LedgerMetrics = {
  startingBankroll: number; bankroll: number; netPnl: number; staked: number;
  roi: number; hitRate: number; settled: number; equity: { i: number; bankroll: number }[];
};
export type LedgerCall = {
  strategy: string; match: string; side: "back" | "lay"; selection: "home" | "draw" | "away";
  odds: number; reasoning: string; status: CallStatus; finalScore: string | null;
  pnl: number | null; stake: number; timestamp: number; signature: string; explorerUrl: string;
};

type LedgerResp = { ok: boolean; calls: LedgerCall[]; record?: LedgerRecord; metrics?: LedgerMetrics | null };

/** ORA's verifiable on-chain track record. Global by default; pass `fixtureId` to scope to one match. */
export default function AgentLedger({ fixtureId, refreshMs = 20_000 }: { fixtureId?: number; refreshMs?: number }) {
  const key = fixtureId ? `/api/agent/ledger?fixtureId=${fixtureId}` : "/api/agent/ledger";
  const { data } = useSWR<LedgerResp>(key, fetcher, { refreshInterval: refreshMs });
  const calls = data?.calls ?? [];
  const record = data?.record;

  return (
    <div>
      <DecisionAudit record={record} total={calls.length} />
      {calls.length === 0 ? (
        <div className="mt-4 flex h-28 items-center justify-center rounded-lg border border-dashed border-white/10 px-4 text-center text-xs text-gray-600">
          {fixtureId ? "ORA hasn't taken a position on this match yet." : "No verifiable calls yet · deploy ORA to make its first."}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {calls.map((c) => <LedgerCard key={c.signature} c={c} />)}
        </div>
      )}
    </div>
  );
}

function DecisionAudit({ record, total }: { record?: LedgerRecord; total: number }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-gray-500">ORA decision audit</p>
          <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-white">{total} <span className="text-xs font-normal text-gray-500">published calls</span></p>
          <p className="text-[10px] text-gray-500">Public research attestations — not a managed fund or a performance claim.</p>
        </div>
        <div className="space-y-0.5 text-right font-mono text-[10px] text-gray-500">
          <p>
            <span className="font-bold text-emerald-400">{record?.won ?? 0}W</span> ·{" "}
            <span className="font-bold text-red-400">{record?.lost ?? 0}L</span>
            {record?.pending ? ` · ${record.pending} open` : ""}
          </p>
          <p>every call has a receipt</p>
        </div>
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
        {c.pnl != null && (
          <span className={cn("ml-2 font-bold", c.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
            {c.pnl >= 0 ? "+" : ""}{c.pnl} USDC
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] italic leading-relaxed text-gray-400">“{c.reasoning}”</p>
      <div className="mt-2 flex items-center justify-between text-[9px]">
        <span className="flex items-center gap-1 text-gray-500">
          <ShieldCheck className="size-2.5 text-emerald-500" /> {c.strategy}
        </span>
        <a href={c.explorerUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-gray-500 transition-colors hover:text-emerald-400">
          Solana {c.signature.slice(0, 6)}… <ExternalLink className="size-2.5" />
        </a>
      </div>
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
