"use client";

import Link from "next/link";
import useSWR from "swr";
import { Brain, Loader2, ArrowRight, Lock, Check } from "lucide-react";
import { cn, fetcher, kickoff } from "@/lib/ui";
import { payoutOn, type OraPick, type Sel } from "@/lib/ora/pick";
import { useBackBet } from "@/hooks/useBackBet";

type Pick = {
  fixtureId: number; p1: string; p2: string; competition: string; startTime: number;
  phase: "upcoming" | "live"; pick: OraPick & { team: string };
};

/** ORA's live AI predictions, each backable in one tap. `stake` sets the amount shown/placed. */
export default function OraPicks({ limit, stake = 50 }: { limit?: number; stake?: number }) {
  const { data, error } = useSWR<{ ok: boolean; picks: Pick[]; error?: string }>(
    "/api/ora/picks", fetcher,
    { refreshInterval: 30_000, keepPreviousData: true, errorRetryCount: 10, errorRetryInterval: 3000 },
  );
  const { back, pendingId, authenticated, error: betError } = useBackBet();
  const picks = (data?.picks ?? []).slice(0, limit ?? 20);
  // Only show the error when there's nothing to display — transient TxLINE blips keep the list.
  const feedError = (Boolean(error) || data?.ok === false) && picks.length === 0;

  return (
    <div className="space-y-2.5">
      {!data && !feedError && (
        <div className="flex h-24 items-center justify-center rounded-xl border border-white/10 bg-[#0a0a0a] text-gray-600">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
      {feedError && picks.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 text-center text-sm text-yellow-500/80">
          Picks unavailable · TxLINE feed may need refreshing.
        </p>
      )}
      {data && !feedError && picks.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 text-center text-sm text-gray-500">
          No live or upcoming matches to price right now.
        </p>
      )}
      {betError && <p className="text-center text-xs text-red-400">{betError}</p>}
      {picks.map((p) => (
        <PickCard key={p.fixtureId} p={p} stake={stake} onBack={back} pending={pendingId === p.fixtureId} authed={authenticated} />
      ))}
    </div>
  );
}

function PickCard({
  p, stake, onBack, pending, authed,
}: {
  p: Pick;
  stake: number;
  onBack: (i: { fixtureId: number; match: string; selection: Sel; odds: number; stake: number }) => void;
  pending: boolean;
  authed: boolean;
}) {
  const payout = payoutOn(stake, p.pick.dec);
  const val = p.pick.value;
  const tierColor =
    p.pick.tier === "strong" ? "text-emerald-400"
      : p.pick.tier === "value" ? "text-emerald-400"
      : p.pick.tier === "slim" ? "text-sky-400" : "text-gray-500";
  const edgeStr = `${p.pick.edge >= 0 ? "+" : ""}${p.pick.edge}pp edge · EV ${p.pick.evPct >= 0 ? "+" : ""}${p.pick.evPct}%`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#0a0a0a] p-4 transition-colors hover:border-white/20 sm:flex-row sm:items-center sm:justify-between">
      {/* Match + ORA's read */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500">
          <span className="truncate">{p.competition}</span>
          {p.phase === "live"
            ? <span className="flex items-center gap-1 text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE</span>
            : <span className="text-gray-500">{kickoff(p.startTime)}</span>}
        </div>
        <Link href={`/market/${p.fixtureId}`} className="mt-0.5 block truncate text-sm font-bold text-white hover:text-emerald-300">
          {p.p1} <span className="text-gray-600">v</span> {p.p2}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px]">
          <span className={cn("flex items-center gap-1 font-medium", val ? "text-emerald-400" : "text-gray-400")}>
            <Brain className="size-3.5" /> {val ? `ORA backs ${p.pick.team}` : "ORA passes"}
          </span>
          <span className={cn("rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", tierColor)}>
            {p.pick.confidence}
          </span>
          {val && <span className="text-gray-500">{p.pick.prob}% model · {edgeStr}</span>}
        </p>
        <p className="mt-1 text-[11px] italic leading-snug text-gray-500">{p.pick.reasoning}</p>
      </div>

      {/* One-tap back, or a disciplined pass */}
      <div className="flex shrink-0 items-center gap-2">
        <Link href={`/market/${p.fixtureId}`} className="hidden text-[11px] text-gray-500 hover:text-white sm:flex sm:items-center sm:gap-1">
          chart <ArrowRight className="size-3" />
        </Link>
        {val ? (
          <button
            onClick={() => onBack({ fixtureId: p.fixtureId, match: `${p.p1} v ${p.p2}`, selection: p.pick.selection, odds: p.pick.dec, stake })}
            disabled={pending}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-emerald-400 disabled:opacity-60">
            {pending ? <><Loader2 className="size-4 animate-spin" /> Backing…</>
              : !authed ? <><Lock className="size-3.5" /> Sign in to back</>
              : <><Check className="size-4" /> Back {stake} → win {payout}</>}
          </button>
        ) : (
          <span className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-medium text-gray-500">No value · standing aside</span>
        )}
      </div>
    </div>
  );
}
