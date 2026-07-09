"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Sparkles, TrendingUp, CheckCircle, ExternalLink, Share2, Check, Zap, ArrowLeft, Loader2 } from "lucide-react";

type MindEntry = {
  kind: "commentary" | "trade";
  title: string; body: string; tag: string; timestamp: number; signature: string; explorerUrl: string;
};
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// A single ORA insight, as a public, shareable, on-chain-verifiable card. This is the viral unit:
// a screenshot-worthy "ORA called it" artifact that anyone can verify on Solana.
export default function MindInsightPage() {
  const { sig } = useParams<{ sig: string }>();
  const { data, isLoading } = useSWR<{ ok: boolean; entries: MindEntry[] }>("/api/pulse/mind", fetcher, { refreshInterval: 20_000 });
  const entry = data?.entries?.find((e) => e.signature === sig) ?? null;
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "ORA's call · WHISTL Pulse", url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    } catch { /* dismissed */ }
  };

  const isPrediction = entry?.kind === "trade";

  return (
    <div className="px-4 py-6">
      <Link href="/mind" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text">
        <ArrowLeft className="size-4" /> ORA&apos;s Mind
      </Link>

      {isLoading && !data && (
        <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-text-dim" /></div>
      )}
      {data && !entry && (
        <p className="rounded-xl border border-line bg-ink-2 p-8 text-center text-sm text-text-dim">This call could not be found.</p>
      )}

      {entry && (
        <>
          {/* The shareable card */}
          <div className="overflow-hidden rounded-2xl border border-signal/30 bg-ink-2">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-signal">
                <Sparkles className="size-3.5" /> ORA · AI Pundit
              </span>
              <span className={`flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider ${isPrediction ? "text-signal" : "text-proof"}`}>
                {isPrediction ? <TrendingUp className="size-2.5" /> : <Sparkles className="size-2.5" />}
                {isPrediction ? "Prediction" : "Match update"}
              </span>
            </div>
            <div className="px-5 py-5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">{entry.tag}</p>
              <h1 className="mt-1 text-xl font-bold leading-snug text-text">{entry.title}</h1>
              {entry.body && <p className="mt-2 text-sm leading-relaxed text-text-dim">{entry.body}</p>}
            </div>
            <a href={entry.explorerUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between border-t border-line px-5 py-3 text-[11px] transition-colors hover:bg-ink">
              <span className="flex items-center gap-1.5 font-mono text-text-dim">
                <CheckCircle className="size-3 text-proof" /> Inscribed on Solana · verify this call
              </span>
              <span className="flex items-center gap-1 font-mono text-signal">{entry.signature.slice(0, 8)}… <ExternalLink className="size-3" /></span>
            </a>
          </div>

          {/* Share + Pro upsell */}
          <div className="mt-4 flex gap-2">
            <button onClick={share} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-signal py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90">
              {copied ? <><Check className="size-4" /> Link copied</> : <><Share2 className="size-4" /> Share this call</>}
            </button>
            <Link href="/mind" className="flex items-center justify-center gap-2 rounded-lg border border-signal/30 bg-signal/[0.06] px-4 py-3 text-sm font-bold text-signal hover:bg-signal/10">
              <Zap className="size-4" /> ORA Pro
            </Link>
          </div>
          <p className="mt-3 text-center font-mono text-[10px] text-text-dim">
            Every ORA call is public and verifiable. No hidden track record.
          </p>
        </>
      )}
    </div>
  );
}
