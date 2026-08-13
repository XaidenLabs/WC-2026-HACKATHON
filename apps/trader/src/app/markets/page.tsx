"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Brain, Loader2, ChevronRight } from "lucide-react";
import OraPicks from "@/components/OraPicks";
import TraderShell from "@/components/TraderShell";
import { cn, fetcher, kickoff } from "@/lib/ui";

type Fixture = { FixtureId: number; Participant1: string; Participant2: string; StartTime: number; Competition: string };
type Phase = "live" | "upcoming" | "ended";
const STAKES = [25, 50, 100, 250];

// All provider markets. Normal list by default; flip the toggle
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
    "/api/markets/fixtures", fetcher,
    { refreshInterval: 30_000, keepPreviousData: true, errorRetryCount: 10, errorRetryInterval: 3000, revalidateOnFocus: true },
  );
  const hasFixtures = (data?.fixtures?.length ?? 0) > 0;
  // Only surface the error when we have nothing to show. Transient feed blips keep the list.
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
    <TraderShell title="Games" subtitle="Live football markets and ORA pricing.">
      <div className="terminal-workspace mx-auto w-full max-w-5xl font-mono">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#ff650f]">Football feed</p>
            <h2 className="mt-1 font-sans text-2xl font-black tracking-tight text-[#efefeb]">Market calendar</h2>
          </div>
          {/* Toggle: Normal ↔ AI predictions */}
          <button onClick={() => setAi((v) => !v)}
            className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors",
              ai ? "border-[#8a3e13] bg-[#25170e] text-[#ff7a2f]" : "border-[#30322c] bg-[#151613] text-[#8a8c85] hover:border-[#55574f] hover:text-[#efefeb]")}>
            <Brain className="size-3.5" />
            AI predictions
            <span className={cn("relative h-4 w-7 rounded-full transition-colors", ai ? "bg-[#ff650f]" : "bg-[#343630]")}>
              <span className={cn("absolute top-0.5 size-3 rounded-full bg-[#0a0b09] transition-all", ai ? "left-3.5" : "left-0.5")} />
            </span>
          </button>
        </div>

        {ai ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 border border-[#30322c] bg-[#11120f] p-3">
              <span className="text-[10px] uppercase tracking-wider text-[#ff7a2f]">If I stake</span>
              {STAKES.map((s) => (
                <button key={s} onClick={() => setStake(s)}
                  className={cn("rounded border px-2.5 py-1 text-xs font-bold", stake === s ? "border-[#ff650f] bg-[#25170e] text-[#ff7a2f]" : "border-[#30322c] text-[#777972] hover:text-[#efefeb]")}>
                  {s}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-[#686a64]">ORA prices every match. Payout shown for {stake} practice credits.</span>
            </div>
            <OraPicks stake={stake} />
          </>
        ) : (
          <>
            {!data && !marketsError && <div className="flex h-24 items-center justify-center text-[#666861]"><Loader2 className="size-5 animate-spin" /></div>}
            {marketsError && <p className="border border-[#4b2b17] bg-[#17110d] p-6 text-center text-sm text-[#d59058]">Markets unavailable. The football feed may need reconnecting.</p>}
            <Group title="Live now" rows={groups.live} accent />
            <Group title="Upcoming" rows={groups.upcoming} />
            <Group title="Recently ended" rows={groups.ended} muted />
            {data && !marketsError && groups.live.length + groups.upcoming.length + groups.ended.length === 0 && (
              <p className="border border-dashed border-[#30322c] p-8 text-center text-sm text-[#686a64]">No matches in range.</p>
            )}
          </>
        )}
      </div>
    </TraderShell>
  );
}

function Group({ title, rows, accent, muted }: { title: string; rows: (Fixture & { phase: Phase })[]; accent?: boolean; muted?: boolean }) {
  if (!rows.length) return null;
  return (
    <div className="mb-6">
      <p className={cn("mb-2 text-[10px] uppercase tracking-wider", accent ? "text-[#4ee58a]" : "text-[#686a64]")}>{title}</p>
      <div className="space-y-px bg-[#252721]">
        {rows.map((f) => (
          <Link key={f.FixtureId} href={`/market/${f.FixtureId}`}
            className={cn("flex items-center justify-between gap-2 bg-[#11120f] px-4 py-3 text-sm transition-colors hover:bg-[#171816]", muted && "opacity-65")}>
            <span className="min-w-0 flex-1 truncate text-[#d8d9d4]">
              {f.Participant1} <span className="text-[#5f615b]">v</span> {f.Participant2}
              <span className="ml-2 hidden text-[10px] text-[#5f615b] sm:inline">{f.Competition}</span>
            </span>
            {f.phase === "live"
              ? <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE</span>
              : <span className="shrink-0 text-[10px] text-[#686a64]">{f.phase === "ended" ? "ended" : kickoff(f.StartTime)}</span>}
            <ChevronRight className="size-4 shrink-0 text-[#5f615b]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
