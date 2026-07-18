"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  Zap, ArrowUp, ArrowDown, ChevronRight, Radio, Activity,
} from "lucide-react";
import type { SharpAlert } from "@/lib/pulse/sharp";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j?.error || `HTTP ${r.status}`), { code: j?.error });
    return j as { ok: boolean; alerts: SharpAlert[]; movers: SharpAlert[]; quiet: boolean; watching: number };
  });

function elapsedLabel(min: number | null): string {
  if (min == null) return "";
  if (min < 90) return `over ${min}m`;
  return `over ${Math.round(min / 60)}h`;
}

export default function AlertsPage() {
  const { data, error, isLoading } = useSWR("/api/pulse/alerts", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });

  const alerts = data?.alerts ?? [];
  const movers = data?.movers ?? [];

  return (
    <div className="px-4 py-5">
      <div className="mb-1 flex items-center gap-2">
        <Zap className="size-5 text-signal" aria-hidden />
        <h1 className="text-lg font-semibold text-text">Sharp Money</h1>
      </div>
      <p className="mb-5 text-sm text-text-dim">
        When the smart money moves a line, you see it first · and why it matters.
        {data ? (
          <span className="ml-1 font-mono text-[11px] text-text-dim/80">
            Watching {data.watching} markets.
          </span>
        ) : null}
      </p>

      {isLoading && !data && (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-ink-2" />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-live/30 bg-live/5 p-4 text-sm text-live">
          {error.code === "TXLINE_TOKEN_MISSING"
            ? "Live odds warming up · check back shortly."
            : `Couldn't load alerts: ${error.message}`}
        </p>
      )}

      {/* Real alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-3">
          {alerts.map((a, i) => (
            <AlertCard key={`${a.fixtureId}-${a.market}-${i}`} a={a} />
          ))}
        </div>
      )}

      {/* Quiet state — show biggest drifts so the screen is never empty */}
      {data && alerts.length === 0 && (
        <div className="rounded-xl border border-line bg-ink-2 p-5 text-center">
          <Activity className="mx-auto mb-2 size-6 text-text-dim" aria-hidden />
          <p className="text-sm font-medium text-text">Markets are quiet right now</p>
          <p className="mt-1 text-xs text-text-dim">
            No sharp moves across the board. Alerts fire when a line swings hard · usually near
            kickoff or after a goal.
          </p>
        </div>
      )}

      {data && alerts.length === 0 && movers.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2.5 font-mono text-[11px] uppercase tracking-widest text-text-dim">
            Biggest drifts
          </h2>
          <div className="flex flex-col gap-2">
            {movers.map((m, i) => (
              <MoverRow key={`${m.fixtureId}-${m.market}-${i}`} m={m} />
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 flex items-center gap-1.5 font-mono text-[10px] text-text-dim">
        <Radio className="size-3" aria-hidden /> Demargined implied odds from TxLINE · refreshes every 60s
      </p>
    </div>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function AlertCard({ a }: { a: SharpAlert }) {
  const sharp = a.severity === "sharp";
  const up = a.direction === "in"; // money in = chance rising
  return (
    <Link
      href={`/match/${a.fixtureId}`}
      className={`block rounded-2xl border p-4 transition-colors ${
        sharp ? "border-live/40 bg-live/8 hover:bg-live/12" : "border-line bg-ink-2 hover:bg-ink-3"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[9px] uppercase tracking-wider text-text-dim">
          {a.market} · {a.phase === "live" ? "live" : "pre-match"}
        </span>
        <SeverityChip severity={a.severity} />
      </div>

      <p className="text-sm font-semibold text-text">{a.headline}</p>

      {/* The move */}
      <div className="mt-2.5 flex items-center gap-2 font-mono text-sm">
        <span className="text-text-dim">{a.outcome}</span>
        <span className="tabular-nums text-text">{a.fromPct}%</span>
        <span className={up ? "text-win" : "text-live"} aria-hidden>
          {up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
        </span>
        <span className="tabular-nums font-semibold text-text">{a.toPct}%</span>
        <span className={`ml-auto tabular-nums font-semibold ${up ? "text-win" : "text-live"}`}>
          {a.shift > 0 ? "+" : ""}
          {a.shift}pp
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className="truncate text-xs text-text-dim">
          {a.match} <span className="text-text-dim/60">· {elapsedLabel(a.elapsedMin)}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-text-dim" aria-hidden />
      </div>
    </Link>
  );
}

function MoverRow({ m }: { m: SharpAlert }) {
  const up = m.direction === "in";
  return (
    <Link
      href={`/match/${m.fixtureId}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 px-3.5 py-2.5"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-text">{m.match}</p>
        <p className="font-mono text-[10px] text-text-dim">
          {m.outcome} {m.fromPct}%→{m.toPct}%
        </p>
      </div>
      <span className={`shrink-0 font-mono text-xs tabular-nums ${up ? "text-win" : "text-text-dim"}`}>
        {m.shift > 0 ? "+" : ""}
        {m.shift}pp
      </span>
    </Link>
  );
}

function SeverityChip({ severity }: { severity: SharpAlert["severity"] }) {
  if (severity === "sharp") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-live/40 bg-live/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-live">
        <Zap className="size-2.5" aria-hidden /> Sharp
      </span>
    );
  }
  return (
    <span className="rounded-full border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-signal">
      Notable
    </span>
  );
}
