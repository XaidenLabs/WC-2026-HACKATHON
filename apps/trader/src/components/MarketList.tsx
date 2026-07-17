"use client";

import Link from "next/link";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { cn, fetcher, kickoff } from "@/lib/ui";

type Fixture = { FixtureId: number; Participant1: string; Participant2: string; StartTime: number; Competition: string };
type Phase = "upcoming" | "live" | "finished";

/** Live TxLINE market list — reused on the landing page and the ORA hub. Tap → per-match desk. */
export default function MarketList({ limit = 12, className }: { limit?: number; className?: string }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, []);
  const { data, error } = useSWR<{ ok: boolean; fixtures: Fixture[]; error?: string }>(
    "/api/txline/fixtures", fetcher, { refreshInterval: 60_000 },
  );
  const marketsError = Boolean(error) || (data && data.ok === false);

  const markets = useMemo(() => {
    const LIVE_MS = 2.5 * 3600e3;
    return (data?.fixtures ?? [])
      .map((f) => ({
        ...f,
        phase: (now < f.StartTime ? "upcoming" : now < f.StartTime + LIVE_MS ? "live" : "finished") as Phase,
      }))
      .filter((f) => f.phase !== "finished")
      .sort((a, b) => Number(b.phase === "live") - Number(a.phase === "live") || a.StartTime - b.StartTime)
      .slice(0, limit);
  }, [data, limit, now]);

  return (
    <div className={cn("space-y-1.5", className)}>
      {markets.length === 0 && !marketsError && <p className="p-3 text-[11px] text-gray-600">Loading live fixtures…</p>}
      {marketsError && markets.length === 0 && (
        <p className="p-3 text-[11px] text-yellow-500/80">Markets unavailable · TxLINE token may need refreshing.</p>
      )}
      {!marketsError && markets.length === 0 && data && (
        <p className="p-3 text-[11px] text-gray-600">No live or upcoming games in range.</p>
      )}
      {markets.map((m) => (
        <Link key={m.FixtureId} href={`/market/${m.FixtureId}`}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/5 bg-[#0d0d0d] px-4 py-3 text-sm transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5">
          <span className="min-w-0 flex-1 truncate text-left text-gray-200">
            {m.Participant1} <span className="text-gray-600">v</span> {m.Participant2}
            <span className="ml-2 hidden text-[10px] text-gray-600 sm:inline">{m.Competition}</span>
          </span>
          {m.phase === "live" ? (
            <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE
            </span>
          ) : (
            <span className="shrink-0 text-[10px] text-gray-500">{kickoff(m.StartTime)}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
