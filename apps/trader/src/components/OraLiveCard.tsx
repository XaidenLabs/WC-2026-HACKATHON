"use client";

import Link from "next/link";
import useSWR from "swr";
import { ShieldCheck, ArrowUpRight } from "lucide-react";
import { cn, fetcher } from "@/lib/ui";
import type { LedgerCall, LedgerRecord } from "@/components/AgentLedger";

/** Hero card: ORA's public Solana-attested decision stream. */
export default function OraLiveCard() {
  const { data } = useSWR<{ ok: boolean; calls: LedgerCall[]; record?: LedgerRecord }>(
    "/api/agent/ledger", fetcher, { refreshInterval: 30_000 },
  );
  const rec = data?.record;
  const last = data?.calls?.[0] ?? null;

  return (
    <Link href="/ora"
      className="group block w-full max-w-md rounded-xl border border-white/10 bg-[#0a0a0a] p-5 font-mono transition-colors hover:border-emerald-500/40">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> ORA · live on-chain
        </span>
        <span className="flex items-center gap-1 text-gray-500 group-hover:text-emerald-400">command center <ArrowUpRight className="size-3" /></span>
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-wider text-gray-500">Public decision log</p>
      <p className="mt-1 text-lg font-bold text-white">Research calls with receipts</p>
      <p className="mt-1 text-[11px] text-gray-500">Each published call is independently traceable on Solana.</p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Cell label="RECORD" value={rec ? `${rec.won}W·${rec.lost}L` : "·"} />
        <Cell label="SETTLED" value={rec ? String(rec.won + rec.lost) : "·"} />
        <Cell label="OPEN" value={rec ? String(rec.pending) : "·"} accent />
      </div>

      {last && (
        <p className="mt-3 truncate text-[11px] italic text-gray-400">
          latest: {last.match} · {last.side} {last.selection} @ {last.odds}
        </p>
      )}
      <p className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-3 text-[10px] text-gray-500">
        <ShieldCheck className="size-3 text-emerald-500" /> calls inscribed on Solana · results read from TxLINE
      </p>
    </Link>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black p-2">
      <p className="text-[8px] uppercase tracking-wider text-gray-600">{label}</p>
      <p className={cn("text-sm font-bold tabular-nums", accent === undefined ? "text-white" : accent ? "text-emerald-400" : "text-red-400")}>{value}</p>
    </div>
  );
}
