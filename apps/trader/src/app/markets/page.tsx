"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Brain, Loader2, ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import OraPicks from "@/components/OraPicks";
import { cn, fetcher, kickoff } from "@/lib/ui";

type Fixture = { FixtureId: number; Participant1: string; Participant2: string; StartTime: number; Competition: string };
type Phase = "live" | "upcoming" | "ended";
const STAKES = [25, 50, 100, 250];

// All TxLINE markets, dumped like whistl's matches page. Normal list by default; flip the toggle
// to have ORA price every match (best outcome + payout) with no tapping.
export default function MarketsPage() {
  const [ai, setAi] = useState(false);
  const [stake, setStake] = useState(50);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, []);
  const { data, error } = useSWR<{ ok: boolean; fixtures: Fixture[]; error?: string }>(
    "/api/txline/fixtures", fetcher,
    { refreshInterval: 30_000, keepPreviousData: true, errorRetryCount: 10, errorRetryInterval: 3000, revalidateOnFocus: true },
  );
  const hasFixtures = (data?.fixtures?.length ?? 0) > 0;
  // Only surface the error when we have nothing to show — transient TxLINE blips keep the list.
  const marketsError = (Boolean(error) || (data?.ok === false)) && !hasFixtures;

  const groups = useMemo(() => {
    const LIVE_MS = 2.5 * 3600e3;
    const all = (data?.fixtures ?? [])
      .map((f) => ({ ...f, phase: (now < f.StartTime ? "upcoming" : now < f.StartTime + LIVE_MS ? "live" : "ended") as Phase }))
      .sort((a, b) => a.StartTime - b.StartTime);
    return {
      live: all.filter((f) => f.phase === "live"),
      upcoming: all.filter((f) => f.phase === "upcoming"),
      ended: all.filter((f) => f.phase === "ended").reverse(),
    };
  }, [data, now]);

  return (
    <div className="min-h-screen bg-[#050505] font-mono text-gray-300">
      <Header tagline="all World Cup markets" />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">World Cup 2026 · TxLINE</p>
            <h1 className="mt-0.5 font-sans text-2xl font-bold text-white">Markets</h1>
          </div>
          {/* Toggle: Normal ↔ AI predictions */}
          <button onClick={() => setAi((v) => !v)}
            className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors",
              ai ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" : "border-white/15 text-gray-400 hover:bg-white/5")}>
            <Brain className="size-3.5" />
            AI predictions
            <span className={cn("relative h-4 w-7 rounded-full transition-colors", ai ? "bg-emerald-500" : "bg-white/15")}>
              <span className={cn("absolute top-0.5 size-3 rounded-full bg-black transition-all", ai ? "left-3.5" : "left-0.5")} />
            </span>
          </button>
        </div>

        {ai ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
              <span className="text-[10px] uppercase tracking-wider text-emerald-400">If I stake</span>
              {STAKES.map((s) => (
                <button key={s} onClick={() => setStake(s)}
                  className={cn("rounded border px-2.5 py-1 text-xs font-bold", stake === s ? "border-emerald-500 text-emerald-400" : "border-white/10 text-gray-400 hover:text-white")}>
                  {s}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-gray-500">ORA prices every match · payout shown for {stake} USDC.</span>
            </div>
            <OraPicks stake={stake} />
          </>
        ) : (
          <>
            {!data && !marketsError && <div className="flex h-24 items-center justify-center text-gray-600"><Loader2 className="size-5 animate-spin" /></div>}
            {marketsError && <p className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 text-center text-sm text-yellow-500/80">Markets unavailable · TxLINE feed may need refreshing.</p>}
            <Group title="Live now" rows={groups.live} accent />
            <Group title="Upcoming" rows={groups.upcoming} />
            <Group title="Recently ended" rows={groups.ended} muted />
            {data && !marketsError && groups.live.length + groups.upcoming.length + groups.ended.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-500">No matches in range.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Group({ title, rows, accent, muted }: { title: string; rows: (Fixture & { phase: Phase })[]; accent?: boolean; muted?: boolean }) {
  if (!rows.length) return null;
  return (
    <div className="mb-6">
      <p className={cn("mb-2 text-[10px] uppercase tracking-wider", accent ? "text-emerald-400" : "text-gray-500")}>{title}</p>
      <div className="space-y-1.5">
        {rows.map((f) => (
          <Link key={f.FixtureId} href={`/market/${f.FixtureId}`}
            className={cn("flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-[#0a0a0a] px-4 py-3 text-sm transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5", muted && "opacity-70")}>
            <span className="min-w-0 flex-1 truncate text-gray-200">
              {f.Participant1} <span className="text-gray-600">v</span> {f.Participant2}
              <span className="ml-2 hidden text-[10px] text-gray-600 sm:inline">{f.Competition}</span>
            </span>
            {f.phase === "live"
              ? <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE</span>
              : <span className="shrink-0 text-[10px] text-gray-500">{f.phase === "ended" ? "ended" : kickoff(f.StartTime)}</span>}
            <ChevronRight className="size-4 shrink-0 text-gray-600" />
          </Link>
        ))}
      </div>
    </div>
  );
}
