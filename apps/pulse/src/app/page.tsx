"use client";

import useSWR from "swr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Dices, ChevronRight, Sparkles } from "lucide-react";
import PushAlertsButton from "@/components/PushAlertsButton";
import type { TxFixture } from "@/lib/txline/types";
import { matchPhase, kickoffLabel } from "@/lib/pulse/format";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j?.error || `HTTP ${r.status}`), { code: j?.error });
    return j as { ok: boolean; fixtures: TxFixture[] };
  });

const byStartAsc = (a: TxFixture, b: TxFixture) => a.StartTime - b.StartTime;

export default function PulseHome() {
  const [now, setNow] = useState(0);
  const { data, error, isLoading } = useSWR("/api/txline/fixtures", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const interval = window.setInterval(updateNow, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const fixtures = Array.from(
    new Map((data?.fixtures ?? []).map((f) => [f.FixtureId, f])).values()
  );
  const live = fixtures.filter((f) => matchPhase(f.StartTime, now) === "live").sort(byStartAsc);
  const upcoming = fixtures.filter((f) => matchPhase(f.StartTime, now) === "upcoming").sort(byStartAsc);
  const finished = fixtures
    .filter((f) => matchPhase(f.StartTime, now) === "finished")
    .sort((a, b) => b.StartTime - a.StartTime)
    .slice(0, 8);

  return (
    <div className="px-4 py-5">
      {/* Hero */}
      <section className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-text">
          Your AI football companion
        </h1>
        <p className="mt-1 text-sm text-text-dim">
          Live commentary, instant alerts, and one-tap games for every World Cup match ·
          powered by real-time match data.
        </p>
      </section>

      {/* Hi-Lo CTA */}
      <Link
        href="/hilo"
        className="mb-7 flex items-center gap-3 rounded-2xl border border-signal/30 bg-signal/8 p-4 transition-colors hover:bg-signal/12"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-signal/15">
          <Dices className="size-5 text-signal" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">Play Hi-Lo</p>
          <p className="truncate text-xs text-text-dim">Higher or lower? One tap. No wallet needed.</p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-text-dim" aria-hidden />
      </Link>

      {/* Push Alerts CTA */}
      <PushAlertsButton />

      {/* Loading / error / empty */}
      {isLoading && !data && <SkeletonList />}
      {error && (
        <p className="rounded-xl border border-live/30 bg-live/5 p-4 text-sm text-live">
          {error.code === "TXLINE_TOKEN_MISSING"
            ? "Live data is warming up · check back shortly."
            : `Couldn't load matches: ${error.message}`}
        </p>
      )}

      {/* Live now */}
      {live.length > 0 && (
        <Section title="Live now" accent>
          {live.map((f) => (
            <MatchRow key={f.FixtureId} fixture={f} now={now} />
          ))}
        </Section>
      )}

      {/* Up next */}
      {upcoming.length > 0 && (
        <Section title="Up next">
          {upcoming.slice(0, 12).map((f) => (
            <MatchRow key={f.FixtureId} fixture={f} now={now} />
          ))}
        </Section>
      )}

      {/* Recent results */}
      {finished.length > 0 && (
        <Section title="Recent results">
          {finished.map((f) => (
            <MatchRow key={f.FixtureId} fixture={f} now={now} />
          ))}
        </Section>
      )}

      {!isLoading && !error && fixtures.length === 0 && (
        <p className="py-10 text-center text-sm text-text-dim">
          No World Cup fixtures in range right now.
        </p>
      )}
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Section({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2.5 flex items-center gap-2">
        {accent && <span className="size-1.5 animate-livedot rounded-full bg-signal" aria-hidden />}
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-dim">{title}</h2>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function MatchRow({ fixture, now }: { fixture: TxFixture & { score?: { p1Goals: number, p2Goals: number, minutes?: number } }; now: number }) {
  const phase = matchPhase(fixture.StartTime, now);
  const label = kickoffLabel(fixture.StartTime, now);

  return (
    <Link
      href={`/match/${fixture.FixtureId}`}
      className="block rounded-xl border border-line bg-ink-2 p-3 transition-colors hover:border-line/80 hover:bg-ink-3"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="truncate font-mono text-[9px] uppercase tracking-wider text-text-dim">
          {fixture.Competition}
        </span>
        <p className="flex items-center gap-1.5 font-mono text-[10px] text-signal">
          <Sparkles className="size-3" aria-hidden />
          {phase === "upcoming" ? "AI match preview" : "AI commentary"}
        </p>
      </div>

      <div className="flex items-stretch gap-3">
        {/* Left Side: Time / Phase */}
        <div className="flex w-12 shrink-0 flex-col items-center justify-center border-r border-line/50 pr-3">
          {phase === "live" ? (
            <>
              <span className="mb-1 size-1.5 animate-livedot rounded-full bg-signal" aria-hidden />
              <span className="font-mono text-[10px] font-semibold text-signal">{fixture.score?.minutes ? `${fixture.score.minutes}'` : "LIVE"}</span>
            </>
          ) : phase === "finished" ? (
            <span className="font-mono text-[10px] font-medium text-text-dim">FT</span>
          ) : (
            <span className="font-mono text-[10px] font-medium text-text-dim">{label}</span>
          )}
        </div>

        {/* Right Side: Teams and Scores */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <div className="flex items-center justify-between">
            <span className="truncate text-sm font-semibold text-text">{fixture.Participant1}</span>
            <span className="font-mono text-sm font-bold tabular-nums text-text">{fixture.score ? fixture.score.p1Goals : "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="truncate text-sm font-semibold text-text">{fixture.Participant2}</span>
            <span className="font-mono text-sm font-bold tabular-nums text-text">{fixture.score ? fixture.score.p2Goals : "-"}</span>
          </div>
        </div>

        <div className="flex items-center justify-center pl-2">
          <ChevronRight className="size-4 text-text-dim" aria-hidden />
        </div>
      </div>
    </Link>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-[68px] animate-pulse rounded-xl border border-line bg-ink-2" />
      ))}
    </div>
  );
}
