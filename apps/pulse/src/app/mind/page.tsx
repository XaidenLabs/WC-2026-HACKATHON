"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { Sparkles, TrendingUp, ExternalLink, CheckCircle, Loader2, Share2, Check, Zap } from "lucide-react";

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
        <Sparkles className="size-5 text-proof" aria-hidden />
        <h1 className="text-lg font-semibold text-text">ORA · Your AI Pundit</h1>
      </div>
      <p className="mb-4 text-sm text-text-dim">
        ORA watches every match and shares its take in real time.
        Every prediction is verified and public — you can always check its track record.
      </p>

      {/* Stat strip */}
      {stats && (
        <div className="mb-5 grid grid-cols-3 gap-2">
          <Stat label="Predictions made" value={stats.total} />
          <Stat label="Match updates" value={stats.commentary} accent="proof" />
          <Stat label="Picks called" value={stats.trades} accent="signal" />
        </div>
      )}

      {/* ORA Pro — monetization surface */}
      <ProCard />

      {isLoading && !data && (
        <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-text-dim" /></div>
      )}
      {error && (
        <p className="rounded-xl border border-live/30 bg-live/5 p-4 text-sm text-live">
          {error.code === "ORA_PUBKEY_MISSING" ? "ORA isn't connected yet." : `Something went wrong: ${error.message}`}
        </p>
      )}
      {data && entries.length === 0 && (
        <p className="py-16 text-center text-sm text-text-dim">ORA hasn&apos;t made a call yet — check back during a match.</p>
      )}

      {/* Timeline */}
      <div className="relative space-y-3">
        {entries.length > 0 && <div className="absolute left-[7px] top-2 bottom-2 w-px bg-line" aria-hidden />}
        {entries.map((e) => <Entry key={e.signature} e={e} />)}
      </div>

      <p className="mt-6 flex items-center gap-1.5 font-mono text-[10px] text-text-dim">
        <CheckCircle className="size-3 text-proof" aria-hidden /> Updates every 20 seconds · all predictions are publicly verifiable
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
  const isPrediction = e.kind === "trade";
  return (
    <div className="relative pl-6">
      {/* node */}
      <div className={`absolute left-0 top-1.5 flex size-3.5 items-center justify-center rounded-full ${isPrediction ? "bg-signal/20" : "bg-proof/20"}`}>
        <div className={`size-1.5 rounded-full ${isPrediction ? "bg-signal" : "bg-proof"}`} />
      </div>
      <article className={`rounded-xl border bg-ink-2 p-3.5 ${isPrediction ? "border-signal/20" : "border-proof/20"}`}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className={`flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider ${isPrediction ? "text-signal" : "text-proof"}`}>
            {isPrediction ? <TrendingUp className="size-2.5" /> : <Sparkles className="size-2.5" />}
            {isPrediction ? "Prediction" : "Match Update"}
          </span>
          <span className="font-mono text-[9px] text-text-dim">{timeAgo(e.timestamp)}</span>
        </div>
        <Link href={`/mind/${e.signature}`} className="block text-sm font-semibold leading-snug text-text hover:text-signal">{e.title}</Link>
        {e.body && <p className="mt-1 text-xs leading-relaxed text-text-dim">{e.body}</p>}
        <div className="mt-2 flex items-center justify-between text-[9px]">
          <span className="truncate font-mono text-text-dim">{e.tag}</span>
          <div className="flex shrink-0 items-center gap-3">
            <ShareButton signature={e.signature} />
            <a href={e.explorerUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-text-dim transition-colors hover:text-signal group">
              <CheckCircle className="size-2.5 text-proof" />
              <span className="group-hover:hidden">Verified ✓</span>
              <span className="hidden group-hover:inline">{e.signature.slice(0, 6)}… <ExternalLink className="size-2.5 inline" /></span>
            </a>
          </div>
        </div>
      </article>
    </div>
  );
}

function ShareButton({ signature }: { signature: string }) {
  const [copied, setCopied] = useState(false);
  const share = async (ev: React.MouseEvent) => {
    ev.preventDefault();
    const url = `${window.location.origin}/mind/${signature}`;
    try {
      if (navigator.share) await navigator.share({ title: "ORA's call · WHISTL Pulse", url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch { /* user dismissed */ }
  };
  return (
    <button onClick={share} className="flex items-center gap-1 font-mono text-text-dim transition-colors hover:text-signal">
      {copied ? <><Check className="size-2.5" /> Copied</> : <><Share2 className="size-2.5" /> Share</>}
    </button>
  );
}

function ProCard() {
  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-signal/30 bg-signal/[0.04] p-4">
      <div className="flex items-center gap-1.5">
        <Zap className="size-4 text-signal" aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-wider text-signal">ORA Pro</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-text">Real-time alerts and ORA&apos;s premium value picks</p>
      <p className="mt-1 text-xs leading-relaxed text-text-dim">
        Instant goal and odds-swing push the second they happen, ORA&apos;s highest-conviction calls, and
        priority sweepstake seats. Free tier stays public and verifiable, forever.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button className="rounded-md bg-signal px-3.5 py-2 text-xs font-bold text-ink transition-opacity hover:opacity-90">
          Go Pro · $4.99/mo
        </button>
        <span className="font-mono text-[10px] text-text-dim">or earn it: win a sweepstake</span>
      </div>
    </div>
  );
}

