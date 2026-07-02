"use client";

import useSWR from "swr";
import { Brain, Sparkles, TrendingUp, ExternalLink, ShieldCheck, Loader2 } from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j?.error || `HTTP ${r.status}`), { code: j?.error });
    return j as { ok: boolean; entries: MindEntry[]; stats: Stats };
  });

type MindEntry = {
  kind: "commentary" | "trade";
  title: string;
  body: string;
  tag: string;
  timestamp: number;
  signature: string;
  explorerUrl: string;
};
type Stats = { total: number; commentary: number; trades: number };

function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MindPage() {
  const { data, error, isLoading } = useSWR("/api/pulse/mind", fetcher, {
    refreshInterval: 20_000,
    shouldRetryOnError: false,
  });
  const entries = data?.entries ?? [];
  const stats = data?.stats;

  return (
    <div className="px-4 py-5">
      {/* Hero */}
      <div className="mb-1 flex items-center gap-2">
        <Brain className="size-5 text-proof" aria-hidden />
        <h1 className="text-lg font-semibold text-text">ORA&apos;s Mind</h1>
      </div>
      <p className="mb-4 text-sm text-text-dim">
        Every thought and every trade ORA makes is inscribed on Solana — a glass skull. Nothing
        hidden, nothing editable. Read its whole mind, verified.
      </p>

      {/* Stat strip */}
      {stats && (
        <div className="mb-5 grid grid-cols-3 gap-2">
          <Stat label="On-chain thoughts" value={stats.total} />
          <Stat label="Commentary" value={stats.commentary} accent="proof" />
          <Stat label="Trades" value={stats.trades} accent="signal" />
        </div>
      )}

      {isLoading && !data && (
        <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-text-dim" /></div>
      )}
      {error && (
        <p className="rounded-xl border border-live/30 bg-live/5 p-4 text-sm text-live">
          {error.code === "ORA_PUBKEY_MISSING" ? "ORA wallet not configured." : `Couldn't reach the chain: ${error.message}`}
        </p>
      )}
      {data && entries.length === 0 && (
        <p className="py-16 text-center text-sm text-text-dim">ORA hasn&apos;t made a move yet.</p>
      )}

      {/* Timeline */}
      <div className="relative space-y-3">
        {entries.length > 0 && <div className="absolute left-[7px] top-2 bottom-2 w-px bg-line" aria-hidden />}
        {entries.map((e) => <Entry key={e.signature} e={e} />)}
      </div>

      <p className="mt-6 flex items-center gap-1.5 font-mono text-[10px] text-text-dim">
        <ShieldCheck className="size-3 text-proof" aria-hidden /> Read live from ORA&apos;s Solana memo history · refreshes every 20s
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "proof" | "signal" }) {
  return (
    <div className="rounded-xl border border-line bg-ink-2 px-3 py-2.5">
      <p className={`font-mono text-xl tabular-nums ${accent === "proof" ? "text-proof" : accent === "signal" ? "text-signal" : "text-text"}`}>{value}</p>
      <p className="font-mono text-[9px] uppercase tracking-wider text-text-dim">{label}</p>
    </div>
  );
}

function Entry({ e }: { e: MindEntry }) {
  const trade = e.kind === "trade";
  return (
    <div className="relative pl-6">
      {/* node */}
      <div className={`absolute left-0 top-1.5 flex size-3.5 items-center justify-center rounded-full ${trade ? "bg-signal/20" : "bg-proof/20"}`}>
        <div className={`size-1.5 rounded-full ${trade ? "bg-signal" : "bg-proof"}`} />
      </div>
      <article className={`rounded-xl border bg-ink-2 p-3.5 ${trade ? "border-signal/20" : "border-proof/20"}`}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className={`flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider ${trade ? "text-signal" : "text-proof"}`}>
            {trade ? <TrendingUp className="size-2.5" /> : <Sparkles className="size-2.5" />}
            {trade ? "Trade" : "Commentary"}
          </span>
          <span className="font-mono text-[9px] text-text-dim">{timeAgo(e.timestamp)}</span>
        </div>
        <p className="text-sm font-semibold leading-snug text-text">{e.title}</p>
        {e.body && <p className="mt-1 text-xs leading-relaxed text-text-dim">{e.body}</p>}
        <div className="mt-2 flex items-center justify-between text-[9px]">
          <span className="truncate font-mono text-text-dim">{e.tag}</span>
          <a href={e.explorerUrl} target="_blank" rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 font-mono text-text-dim transition-colors hover:text-signal">
            <ShieldCheck className="size-2.5 text-proof" /> {e.signature.slice(0, 6)}… <ExternalLink className="size-2.5" />
          </a>
        </div>
      </article>
    </div>
  );
}
