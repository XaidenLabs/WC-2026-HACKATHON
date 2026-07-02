"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { RefreshCw, RadioTower, TriangleAlert, Brain } from "lucide-react";
import type { TxFixture, TxOddsEntry } from "@/lib/txline/types";
import { parse1X2, parseAH0 } from "@/lib/txline/types";
import OraModal from "@/components/OraModal";

type FixturesOk = { ok: true; source: string; fixtures: TxFixture[] };
type OddsOk = { ok: boolean; odds: TxOddsEntry[] };
type FetchError = Error & { status?: number; code?: string };

async function fixtureFetcher(url: string): Promise<FixturesOk> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error || `HTTP ${res.status}`) as FetchError;
    err.status = res.status;
    err.code = json?.error;
    throw err;
  }
  return json as FixturesOk;
}

const oddsFetcher = (url: string): Promise<OddsOk> => fetch(url).then((r) => r.json());

function fmtKickoff(ms: number) {
  const d = new Date(ms); // StartTime from TxLINE is already in milliseconds
  return {
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  };
}

function FixtureCard({ f }: { f: TxFixture }) {
  const [oraOpen, setOraOpen] = useState(false);

  const { data: oddsData } = useSWR<OddsOk>(
    `/api/txline/odds/${f.FixtureId}`,
    oddsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const odds = oddsData?.odds ?? [];
  const x12 = parse1X2(odds);
  const market = x12 ?? parseAH0(odds);
  const isLive = odds.some((o) => o.InRunning);
  // Ended: kicked off more than 2h ago and no in-running odds (StartTime is ms)
  const isEnded = !isLive && Date.now() > f.StartTime + 2 * 3600 * 1000;
  const { time, date } = fmtKickoff(f.StartTime);

  return (
    <>
      <div className={`flex h-full flex-col rounded-xl border bg-ink-2 p-5 transition-colors ${isEnded ? "border-line/40 opacity-70" : "border-line hover:border-signal/40 hover:bg-ink-3"}`}>
        {/* Top row */}
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">
            {f.Competition || "World Cup 2026"}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-live">
              <span className="size-1.5 animate-pulse rounded-full bg-live" />
              LIVE
            </span>
          )}
          {isEnded && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">
              ENDED
            </span>
          )}
        </div>

        {/* Teams */}
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-text">{f.Participant1}</p>
          <p className="font-mono text-xs text-text-dim">vs</p>
          <p className="font-semibold text-text">{f.Participant2}</p>
        </div>

        {/* Odds chips — readable labels */}
        {market && (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="rounded-md border border-line bg-ink px-2 py-1.5 text-center">
              <p className="font-mono text-[9px] uppercase tracking-wider text-text-dim">Home</p>
              <p className="font-mono text-xs font-bold text-text">{market.home.dec.toFixed(2)}</p>
            </div>
            {x12 ? (
              <div className="rounded-md border border-line bg-ink px-2 py-1.5 text-center">
                <p className="font-mono text-[9px] uppercase tracking-wider text-text-dim">Draw</p>
                <p className="font-mono text-xs font-bold text-text">{x12.draw.dec.toFixed(2)}</p>
              </div>
            ) : (
              <div />
            )}
            <div className="rounded-md border border-line bg-ink px-2 py-1.5 text-center">
              <p className="font-mono text-[9px] uppercase tracking-wider text-text-dim">Away</p>
              <p className="font-mono text-xs font-bold text-text">{market.away.dec.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOraOpen(true)}
            className="flex items-center gap-1 rounded-md border border-signal/30 bg-signal/8 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-signal transition-colors hover:bg-signal/15"
            title="Open ORA Sentinel analysis"
          >
            <Brain className="size-3" />
            ORA
          </button>
          <span className="flex-1 text-right font-mono text-[10px] text-text-dim">{time} · {date}</span>
          {isEnded ? (
            <span className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] text-text-dim">
              FT
            </span>
          ) : (
            <Link
              href={`/pact/new?fixture=${f.FixtureId}`}
              className="rounded-md bg-signal px-3 py-1.5 font-mono text-[11px] font-semibold text-ink transition-opacity hover:opacity-90"
            >
              Bet
            </Link>
          )}
        </div>
      </div>

      {oraOpen && (
        <OraModal
          fixtureId={f.FixtureId}
          p1={f.Participant1}
          p2={f.Participant2}
          onClose={() => setOraOpen(false)}
        />
      )}
    </>
  );
}

export default function MatchesPage() {
  const { data, error, isLoading, mutate } = useSWR<FixturesOk, FetchError>(
    "/api/txline/fixtures",
    fixtureFetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const allFixtures = [...(data?.fixtures ?? [])].sort((a, b) => a.StartTime - b.StartTime);
  
  // Split into live/upcoming vs ended (kicked off > 2h ago)
  const now = Date.now();
  const liveOrUpcoming = allFixtures.filter((f) => now <= f.StartTime + 2 * 3600 * 1000);
  const ended = allFixtures.filter((f) => now > f.StartTime + 2 * 3600 * 1000);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-text-dim">World Cup 2026</p>
          <h1 className="mt-1 text-2xl font-semibold text-text">Matches</h1>
        </div>
        {data && (
          <button
            type="button"
            onClick={() => mutate()}
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 font-mono text-xs text-text-dim hover:bg-ink-2 hover:text-text"
          >
            <RefreshCw className="size-3" />
            {allFixtures.length} fixtures
          </button>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-line bg-ink-2" />
          ))}
        </div>
      )}

      {!isLoading && error?.code === "TXLINE_TOKEN_MISSING" && (
        <div className="flex flex-col items-center rounded-xl border border-line bg-ink-2 px-8 py-16 text-center">
          <RadioTower className="mb-4 size-8 text-text-dim" />
          <h2 className="text-lg font-medium text-text">Awaiting live TxLINE data</h2>
          <p className="mt-2 text-sm text-text-dim">Set TXLINE_API_TOKEN in app/.env.local.</p>
          <button type="button" onClick={() => mutate()} className="mt-6 inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-text hover:bg-ink-3">
            <RefreshCw className="size-4" /> Retry
          </button>
        </div>
      )}

      {!isLoading && error && error.code !== "TXLINE_TOKEN_MISSING" && (
        <div className="flex flex-col items-center rounded-xl border border-line bg-ink-2 px-8 py-16 text-center">
          <TriangleAlert className="mb-4 size-8 text-text-dim" />
          <h2 className="text-lg font-medium text-text">Couldn&apos;t reach TxLINE</h2>
          <p className="mt-2 text-sm text-text-dim">{error.message}</p>
          <button type="button" onClick={() => mutate()} className="mt-6 inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-text hover:bg-ink-3">
            <RefreshCw className="size-4" /> Retry
          </button>
        </div>
      )}

      {/* Live / Upcoming */}
      {!isLoading && !error && liveOrUpcoming.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-live" />
            <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim">
              Live &amp; upcoming
              <span className="ml-2 text-text-dim/60">{liveOrUpcoming.length}</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {liveOrUpcoming.map((f) => (
              <FixtureCard key={f.FixtureId} f={f} />
            ))}
          </div>
        </section>
      )}

      {/* Ended */}
      {!isLoading && !error && ended.length > 0 && (
        <section className={liveOrUpcoming.length > 0 ? "mt-10" : ""}>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="font-mono text-xs uppercase tracking-widest text-text-dim">
              Ended
              <span className="ml-2 text-text-dim/60">{ended.length}</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {ended.map((f) => (
              <FixtureCard key={f.FixtureId} f={f} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && !error && allFixtures.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-line bg-ink-2 px-8 py-16 text-center">
          <RadioTower className="mb-4 size-8 text-text-dim" />
          <h2 className="text-lg font-medium text-text">No fixtures right now</h2>
          <p className="mt-2 text-sm text-text-dim">Check back when matches are scheduled.</p>
        </div>
      )}
    </main>
  );
}

