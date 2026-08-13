"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  Ban,
  Brain,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Loader2,
  Radio,
  ShieldCheck,
} from "lucide-react";
import AgentLedger, { type LedgerCall, type LedgerPass, type LedgerRecord } from "@/components/AgentLedger";
import type { OraForecast, OraOpportunity } from "@/lib/ora/engine-domain";
import { cn, fetcher } from "@/lib/ui";

const TIME_ZONE = "Africa/Lagos";
type Phase = "live" | "upcoming" | "completed";
type Filter = "all" | Phase;
type OraState = "selected" | "passed" | "watching" | "unavailable";

type Score = {
  p1Goals: number;
  p2Goals: number;
  minutes: number;
  clockRunning: boolean;
  isFinished: boolean;
};

type Fixture = {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  StartTime: number;
  Competition: string;
  score?: Score | null;
};

type Pick = {
  fixtureId: number;
  p1: string;
  p2: string;
  competition: string;
  startTime: number;
  phase: "upcoming" | "live";
  forecast: OraForecast;
  alternatives?: OraForecast[];
  trade: OraOpportunity | null;
};

type CalendarItem = Fixture & {
  dateKey: string;
  phase: Phase;
  oraState: OraState;
  pick?: Pick;
  call?: LedgerCall;
  pass?: LedgerPass;
};

type FixturesResponse = { ok: boolean; fixtures: Fixture[]; error?: string };
type PicksResponse = { ok: boolean; picks: Pick[]; error?: string };
type LedgerResponse = {
  ok: boolean;
  calls: LedgerCall[];
  passes?: LedgerPass[];
  record?: LedgerRecord;
  error?: string;
};

function dateKey(ts: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ts));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dayLabel(key: string, today: string): { short: string; day: string } {
  const date = new Date(`${key}T12:00:00+01:00`);
  return {
    short: key === today ? "Today" : date.toLocaleDateString("en-NG", { timeZone: TIME_ZONE, weekday: "short" }),
    day: date.toLocaleDateString("en-NG", { timeZone: TIME_ZONE, day: "numeric", month: "short" }),
  };
}

function matchTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-NG", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function phaseFor(fixture: Fixture, now: number): Phase {
  if (fixture.score?.isFinished) return "completed";
  if (now < fixture.StartTime) return "upcoming";
  // When score data is unavailable, avoid leaving an old match permanently live.
  if (now >= fixture.StartTime + 4 * 60 * 60 * 1000) return "completed";
  return "live";
}

function stateFor(call: LedgerCall | undefined, pass: LedgerPass | undefined, pick: Pick | undefined, phase: Phase): OraState {
  if (call) return "selected";
  if (pass) return "passed";
  if (pick?.trade?.pick?.value === true) return "selected";
  if (pick?.forecast) return "passed";
  return phase === "completed" ? "unavailable" : "watching";
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

export default function OraCalendarHome({ embedded = false, showLedger = true }: { embedded?: boolean; showLedger?: boolean }) {
  const [now, setNow] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const fixturesQuery = useSWR<FixturesResponse>("/api/markets/fixtures", fetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  });
  const picksQuery = useSWR<PicksResponse>("/api/ora/picks", fetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  });
  const ledgerQuery = useSWR<LedgerResponse>("/api/agent/ledger", fetcher, {
    refreshInterval: 20_000,
    keepPreviousData: true,
  });

  const today = dateKey(now);
  const items = useMemo<CalendarItem[]>(() => {
    const picks = new Map((picksQuery.data?.picks ?? []).map((pick) => [pick.fixtureId, pick]));
    const calls = new Map(
      (ledgerQuery.data?.calls ?? [])
        .filter((call) => call.fixtureId != null)
        .map((call) => [call.fixtureId as number, call]),
    );
    const passes = new Map((ledgerQuery.data?.passes ?? []).map((pass) => [pass.fixtureId, pass]));
    return (fixturesQuery.data?.fixtures ?? [])
      .map((fixture) => {
        const phase = phaseFor(fixture, now);
        const pick = picks.get(fixture.FixtureId);
        const call = calls.get(fixture.FixtureId);
        const pass = passes.get(fixture.FixtureId);
        return {
          ...fixture,
          dateKey: dateKey(fixture.StartTime),
          phase,
          pick,
          call,
          pass,
          oraState: stateFor(call, pass, pick, phase),
        };
      })
      .sort((a, b) => a.StartTime - b.StartTime);
  }, [fixturesQuery.data, picksQuery.data, ledgerQuery.data, now]);

  const dates = useMemo(() => Array.from(new Set(items.map((item) => item.dateKey))), [items]);
  const activeDate = useMemo(() => {
    if (selectedDate && dates.includes(selectedDate)) return selectedDate;
    if (dates.includes(today)) return today;
    return dates.find((key) => key > today) ?? dates[dates.length - 1] ?? today;
  }, [selectedDate, dates, today]);

  const dayItems = items.filter((item) => item.dateKey === activeDate);
  const visibleItems = dayItems.filter((item) => filter === "all" || item.phase === filter);
  const counts = {
    selected: dayItems.filter((item) => item.oraState === "selected").length,
    passed: dayItems.filter((item) => item.oraState === "passed").length,
    watching: dayItems.filter((item) => item.oraState === "watching").length,
    receipts: dayItems.filter((item) => item.call || item.pass).length,
  };
  const loading = !fixturesQuery.data && !fixturesQuery.error;
  const feedError = Boolean(fixturesQuery.error) || fixturesQuery.data?.ok === false;

  return (
    <div className={cn("w-full", embedded ? "p-0" : "mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8")}>
      {!embedded && <section className="mb-6 flex flex-col gap-4 border-b border-[#ded7e8] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Football intelligence · Lagos time
          </div>
          <h1 className="mt-2 font-sans text-3xl font-bold tracking-tight text-[#21172f] sm:text-4xl">
            What is ORA doing today?
          </h1>
          <p className="mt-2 max-w-2xl font-sans text-sm text-[#756d82]">
            Every game, every pick, and every pass. ORA keeps the full history for you.
          </p>
        </div>
        <Link href="/ora#ledger" className="inline-flex items-center gap-2 self-start rounded-full border border-[#d9d0e7] bg-white px-4 py-2 text-xs font-bold text-[#50465f] hover:border-[#a98cf8] hover:text-[#21172f] sm:self-auto">
          <ShieldCheck className="size-3.5 text-emerald-400" /> Complete record <ChevronRight className="size-3.5" />
        </Link>
      </section>}

      <div className={cn("grid gap-8", showLedger && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
        <main className="min-w-0">
          <DateStrip dates={dates} activeDate={activeDate} today={today} onSelect={(key) => { setSelectedDate(key); setFilter("all"); }} />

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Selected" value={counts.selected} tone="signal" />
            <Metric label="Passed" value={counts.passed} />
            <Metric label="Watching" value={counts.watching} />
            <Metric label="Saved" value={counts.receipts} />
          </div>

          <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Filter games by state">
            {FILTERS.map((item) => {
              const count = item.id === "all" ? dayItems.length : dayItems.filter((game) => game.phase === item.id).length;
              return (
                <button key={item.id} onClick={() => setFilter(item.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
                    filter === item.id ? "border-[#8059e8] bg-[#8059e8] text-white" : "border-[#ded7e8] bg-white text-[#756d82] hover:border-[#bba9d0] hover:text-[#21172f]",
                  )}>
                  {item.label} <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          <section className="mt-4 space-y-2.5" aria-live="polite">
            {loading && <LoadingState />}
            {feedError && !items.length && <ErrorState />}
            {!loading && !feedError && visibleItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#d9d0e7] bg-white/60 px-4 py-12 text-center">
                <p className="text-sm font-bold text-[#50465f]">No {filter === "all" ? "games" : filter} on this date.</p>
                <p className="mt-1 text-xs text-[#8a8295]">Choose another date or filter.</p>
              </div>
            )}
            {visibleItems.map((item) => <MatchCard key={item.FixtureId} item={item} />)}
          </section>
        </main>

        {showLedger && <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#756d82]">
              <Radio className="size-3 text-emerald-400" /> Latest public decisions
            </div>
            <span className="text-[9px] text-[#8a8295]">Latest ORA activity</span>
          </div>
          <AgentLedger limit={3} />
          <Link href="/ora#ledger" className="mt-3 flex items-center justify-center gap-1 rounded-full border border-[#d9d0e7] bg-white py-2.5 text-[11px] font-bold text-[#756d82] hover:border-[#a98cf8] hover:text-[#21172f]">
            View every win, loss and pass <ChevronRight className="size-3" />
          </Link>
        </aside>}
      </div>
    </div>
  );
}

function DateStrip({ dates, activeDate, today, onSelect }: { dates: string[]; activeDate: string; today: string; onSelect: (key: string) => void }) {
  if (!dates.length) return <div className="h-[58px] animate-pulse rounded-xl bg-white/5" />;
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Choose match date">
      {dates.map((key) => {
        const label = dayLabel(key, today);
        const active = key === activeDate;
        return (
          <button key={key} onClick={() => onSelect(key)}
            className={cn(
              "min-w-[76px] shrink-0 rounded-xl border px-3 py-2.5 text-left transition-colors",
              active ? "border-[#8059e8] bg-[#ede7ff] shadow-[0_8px_20px_rgba(91,62,145,0.1)]" : "border-[#ded7e8] bg-white hover:border-[#bba9d0]",
            )}>
            <span className={cn("block text-[9px] uppercase tracking-wider", active ? "text-[#8059e8]" : "text-[#8a8295]")}>{label.short}</span>
            <span className={cn("mt-0.5 block text-sm font-bold", active ? "text-[#21172f]" : "text-[#50465f]")}>{label.day}</span>
          </button>
        );
      })}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "signal" }) {
  return (
    <div className="rounded-2xl border border-[#ded7e8] bg-white px-3 py-3 shadow-[0_8px_22px_rgba(61,42,86,0.05)]">
      <p className="text-[9px] uppercase tracking-wider text-[#8a8295]">{label}</p>
      <p className={cn("mt-0.5 text-xl font-bold tabular-nums text-[#21172f]", tone === "signal" && "text-[#8059e8]")}>{value}</p>
    </div>
  );
}

const STATE_STYLE: Record<OraState, { label: string; icon: typeof Brain; className: string }> = {
  selected: { label: "Selected", icon: Check, className: "border-[#b9a6f5] bg-[#eee8ff] text-[#6f4fd1]" },
  passed: { label: "Passed", icon: Ban, className: "border-[#ded7e8] bg-[#f6f3f8] text-[#756d82]" },
  watching: { label: "Watching", icon: Eye, className: "border-sky-500/20 bg-sky-500/10 text-sky-400" },
  unavailable: { label: "No decision", icon: AlertTriangle, className: "border-[#e5dfe9] bg-white text-[#9b94a3]" },
};

function MatchCard({ item }: { item: CalendarItem }) {
  const state = STATE_STYLE[item.oraState];
  const StateIcon = state.icon;
  const receipt = item.call ?? item.pass;
  const analysis = item.pick?.trade?.pick;
  const forecast = item.pick?.forecast;
  const reason = item.call?.reasoning
    ?? item.pass?.reason
    ?? analysis?.reasoning
    ?? forecast?.reasoning
    ?? (item.phase === "completed" ? "No published ORA decision exists for this match." : "ORA is waiting for a price it can evaluate.");
  const selectedTeam = item.pick?.trade?.selectionLabel
    ?? (item.call?.selection === "home" ? item.Participant1 : item.call?.selection === "away" ? item.Participant2 : item.call?.selection === "draw" ? "Draw" : null);

  return (
    <article className={cn(
      "rounded-2xl border bg-white p-4 shadow-[0_10px_28px_rgba(57,37,80,0.06)] transition hover:-translate-y-0.5 hover:border-[#bca9d2]",
      item.call?.status === "won" ? "border-emerald-500/30" : item.call?.status === "lost" ? "border-red-500/30" : "border-white/10",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-wider text-gray-600">
            <PhaseBadge phase={item.phase} />
            <span className="text-[#756d82]">{matchTime(item.StartTime)} WAT</span>
            <span className="truncate">{item.Competition}</span>
          </div>
          <Link href={`/market/${item.FixtureId}`} className="mt-2 block font-sans text-base font-bold text-[#21172f] hover:text-[#8059e8] sm:text-lg">
            {item.Participant1} <span className="font-normal text-[#aaa2b4]">v</span> {item.Participant2}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.score && (item.phase === "live" || item.phase === "completed") && (
            <span className="rounded-md bg-[#21172f] px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-white">
              {item.score.p1Goals}–{item.score.p2Goals}
            </span>
          )}
          <span className={cn("flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider", state.className)}>
            <StateIcon className="size-3" /> {state.label}
          </span>
        </div>
      </div>

      <div className="mt-3 border-t border-[#eee9f1] pt-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {selectedTeam && item.oraState === "selected" && <span className="font-bold text-[#8059e8]">ORA: {selectedTeam}</span>}
          {analysis?.value && <span className="text-[#756d82]">{analysis.dec.toFixed(2)}× · {analysis.edge >= 0 ? "+" : ""}{analysis.edge}pp edge · EV {analysis.evPct >= 0 ? "+" : ""}{analysis.evPct}%</span>}
          {!analysis && forecast && <span className="font-bold text-[#8059e8]">Forecast: {forecast.selectionLabel} · {forecast.probabilityPct}% model</span>}
          {item.call?.status === "won" && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-400">WON {item.call.finalScore}</span>}
          {item.call?.status === "lost" && <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-bold text-red-400">LOST {item.call.finalScore}</span>}
          {item.call?.status === "pending" && <span className="rounded bg-white/5 px-1.5 py-0.5 font-bold text-gray-500">PENDING</span>}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-[#756d82]">{reason}</p>
        <div className="mt-3 flex items-center justify-between gap-3 text-[9px]">
          <span className="text-[#9b94a3]">{receipt ? "Saved decision" : analysis ? "Strong live read, waiting for a useful price" : forecast ? "Forecast only, no pick suggested" : "No ORA decision yet"}</span>
          <div className="flex items-center gap-3">
            {receipt && (
              <a href={receipt.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#756d82] hover:text-[#8059e8]">
                View details <ExternalLink className="size-2.5" />
              </a>
            )}
            <Link href={`/market/${item.FixtureId}`} className="flex items-center gap-1 font-bold text-[#50465f] hover:text-[#8059e8]">
              Open match <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function PhaseBadge({ phase }: { phase: Phase }) {
  if (phase === "live") return <span className="flex items-center gap-1 font-bold text-emerald-400"><Radio className="size-2.5" /> Live</span>;
  if (phase === "completed") return <span className="flex items-center gap-1 text-gray-500"><Check className="size-2.5" /> Completed</span>;
  return <span className="flex items-center gap-1 text-gray-500"><Clock className="size-2.5" /> Upcoming</span>;
}

function LoadingState() {
  return (
    <div className="flex h-36 items-center justify-center rounded-2xl border border-[#ded7e8] bg-white text-[#8a8295]">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-10 text-center">
      <AlertTriangle className="mx-auto size-5 text-yellow-500/70" />
      <p className="mt-2 text-sm font-bold text-yellow-200/70">The football feed is temporarily unavailable.</p>
      <p className="mt-1 text-xs text-gray-600">ORA will reconnect automatically.</p>
    </div>
  );
}
