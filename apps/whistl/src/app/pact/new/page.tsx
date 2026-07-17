"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { usePrivy } from "@privy-io/react-auth";
import {
  ArrowLeft, ShieldCheck, Loader2, LogIn, Sparkles, Coins,
  TrendingUp, Target, BarChart2, CheckCircle2, Flag, ChevronRight,
} from "lucide-react";
import type { TxFixture, TxOddsEntry, TxScoreEvent } from "@/lib/txline/types";
import { parse1X2, parseAH0, parseOU, parseCurrentScore } from "@/lib/txline/types";
import type { OraQuote } from "@/lib/ora/pricer";
import { useWhistlActions } from "@/lib/whistl/client";
import type { PactTermsArgs } from "@/lib/whistl/program";
import { humanStatement } from "@/lib/bet-statement";

// ─── Fetchers ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j?.error || `HTTP ${r.status}`), { code: j?.error });
    return j;
  });

// ─── Types ────────────────────────────────────────────────────────────────────

type BetOption = {
  id: string;
  group: "result" | "goals" | "stats";
  label: string;
  sublabel: string;
  terms: PactTermsArgs;
  pTrue: number | null;
  source: "txline" | "model";
  decOdds?: number;
  actualStatValue?: number;
  actualResult?: boolean;
};

function computeActual(terms: PactTermsArgs, stats: Record<string, number>): { value: number; result: boolean } | null {
  const a = stats[String(terms.statAKey)];
  if (a == null) return null;
  const value = terms.hasStatB
    ? terms.op === 0 ? a + (stats[String(terms.statBKey)] ?? 0) : a - (stats[String(terms.statBKey)] ?? 0)
    : a;
  const result =
    terms.comparison === 0 ? value > terms.threshold :
    terms.comparison === 1 ? value < terms.threshold :
    value === terms.threshold;
  return { value, result };
}

function buildOptions(p1: string, p2: string, odds: TxOddsEntry[], finalStats?: Record<string, number>): BetOption[] {
  const x12 = parse1X2(odds);
  const ah0 = parseAH0(odds);
  const ou = parseOU(odds);
  const opts: BetOption[] = [];

  if (x12) {
    opts.push({ id: "p1_wins", group: "result", label: `${p1} wins`, sublabel: `${p1} goals − ${p2} goals > 0`,
      terms: { statAKey: 1, statAPeriod: 0, hasStatB: true, statBKey: 2, statBPeriod: 0, op: 1, comparison: 0, threshold: 0 },
      pTrue: x12.home.pct != null ? x12.home.pct / 100 : null, source: "txline", decOdds: x12.home.dec });
    opts.push({ id: "draw", group: "result", label: "Draw", sublabel: "Goal margin = 0",
      terms: { statAKey: 1, statAPeriod: 0, hasStatB: true, statBKey: 2, statBPeriod: 0, op: 1, comparison: 2, threshold: 0 },
      pTrue: x12.draw.pct != null ? x12.draw.pct / 100 : null, source: "txline", decOdds: x12.draw.dec });
    opts.push({ id: "p2_wins", group: "result", label: `${p2} wins`, sublabel: `${p2} goals − ${p1} goals > 0`,
      terms: { statAKey: 2, statAPeriod: 0, hasStatB: true, statBKey: 1, statBPeriod: 0, op: 1, comparison: 0, threshold: 0 },
      pTrue: x12.away.pct != null ? x12.away.pct / 100 : null, source: "txline", decOdds: x12.away.dec });
  } else if (ah0) {
    opts.push({ id: "p1_wins", group: "result", label: `${p1} wins`, sublabel: `${p1} goals − ${p2} goals > 0`,
      terms: { statAKey: 1, statAPeriod: 0, hasStatB: true, statBKey: 2, statBPeriod: 0, op: 1, comparison: 0, threshold: 0 },
      pTrue: ah0.home.pct != null ? ah0.home.pct / 100 : null, source: "txline", decOdds: ah0.home.dec });
    opts.push({ id: "p2_wins", group: "result", label: `${p2} wins`, sublabel: `${p2} goals − ${p1} goals > 0`,
      terms: { statAKey: 2, statAPeriod: 0, hasStatB: true, statBKey: 1, statBPeriod: 0, op: 1, comparison: 0, threshold: 0 },
      pTrue: ah0.away.pct != null ? ah0.away.pct / 100 : null, source: "txline", decOdds: ah0.away.dec });
  }

  if (ou) {
    const line = parseFloat(ou.line);
    opts.push({ id: "over_goals", group: "goals", label: `Over ${ou.line} goals`, sublabel: `Total goals > ${Math.floor(line)}`,
      terms: { statAKey: 1, statAPeriod: 0, hasStatB: true, statBKey: 2, statBPeriod: 0, op: 0, comparison: 0, threshold: Math.floor(line) },
      pTrue: ou.over.pct != null ? ou.over.pct / 100 : null, source: "txline", decOdds: ou.over.dec });
    opts.push({ id: "under_goals", group: "goals", label: `Under ${ou.line} goals`, sublabel: `Total goals < ${Math.ceil(line)}`,
      terms: { statAKey: 1, statAPeriod: 0, hasStatB: true, statBKey: 2, statBPeriod: 0, op: 0, comparison: 1, threshold: Math.ceil(line) },
      pTrue: ou.under.pct != null ? ou.under.pct / 100 : null, source: "txline", decOdds: ou.under.dec });
  } else {
    opts.push({ id: "over_goals", group: "goals", label: "Over 2 goals", sublabel: "Total goals > 2",
      terms: { statAKey: 1, statAPeriod: 0, hasStatB: true, statBKey: 2, statBPeriod: 0, op: 0, comparison: 0, threshold: 2 },
      pTrue: null, source: "model" });
  }

  opts.push({ id: "corner_diff", group: "stats", label: `${p1} corners lead`, sublabel: `${p1} corners − ${p2} corners > 1`,
    terms: { statAKey: 7, statAPeriod: 0, hasStatB: true, statBKey: 8, statBPeriod: 0, op: 1, comparison: 0, threshold: 1 },
    pTrue: null, source: "model" });
  opts.push({ id: "total_corners", group: "stats", label: "Over 9 corners total", sublabel: "Total corners > 9",
    terms: { statAKey: 7, statAPeriod: 0, hasStatB: true, statBKey: 8, statBPeriod: 0, op: 0, comparison: 0, threshold: 9 },
    pTrue: null, source: "model" });

  if (finalStats && Object.keys(finalStats).length > 0) {
    for (const s of opts) {
      const actual = computeActual(s.terms, finalStats);
      if (actual) { s.actualStatValue = actual.value; s.actualResult = actual.result; }
    }
  }
  // Make every slip line read in plain English instead of the raw predicate string.
  for (const o of opts) o.sublabel = humanStatement(o.terms, p1, p2);
  return opts;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtUsdc = (n: number) => n.toFixed(2);
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

// Compute ORA's counter-stake from the fair probability of creator winning.
// Zero-EV for both sides: oraStake × p = creatorStake × (1-p)
function computeOraStake(creatorStake: number, pTrue: number): number {
  const p = Math.max(0.05, Math.min(0.95, pTrue));
  return creatorStake * (1 - p) / p;
}

// ─── Bet option card ──────────────────────────────────────────────────────────

function OptionCard({ opt, selected, stake, onSelect }: {
  opt: BetOption; selected: boolean; stake: number; onSelect: () => void;
}) {
  const pTrue = opt.pTrue;
  const oraStake = pTrue != null ? computeOraStake(stake, pTrue) : stake;
  const profit = oraStake;
  const decOdds = pTrue != null ? 1 / pTrue : opt.decOdds ?? 2;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
        selected ? "border-signal bg-signal/10" : "border-line bg-ink-2 hover:border-signal/50 hover:bg-ink-3"
      }`}
    >
      {selected && <CheckCircle2 className="absolute right-3 top-3 size-4 text-signal" />}

      <p className="pr-5 text-sm font-semibold text-text">{opt.label}</p>

      {/* Decimal odds big + win amount */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`font-mono text-lg font-bold tabular-nums ${selected ? "text-signal" : "text-text"}`}>
          {decOdds.toFixed(2)}×
        </span>
        {stake > 0 && (
          <span className="font-mono text-xs text-text-dim">
            win +{fmtUsdc(profit)} USDC
          </span>
        )}
      </div>

      {/* Probability bar */}
      {pTrue != null && (
        <div className="mt-2.5">
          <div className="h-1 overflow-hidden rounded-full bg-ink">
            <div
              className={`h-full rounded-full transition-all ${selected ? "bg-signal" : "bg-text-dim/40"}`}
              style={{ width: `${Math.round(pTrue * 100)}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[9px] text-text-dim">{fmtPct(pTrue)} chance</p>
        </div>
      )}

      {/* Actual result badge for finished matches */}
      {opt.actualResult != null && (
        <div className={`mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[9px] font-semibold ${
          opt.actualResult ? "bg-signal/10 text-signal" : "bg-live/10 text-live"
        }`}>
          {opt.actualResult ? "✓ TRUE" : "✗ FALSE"} · actual: {opt.actualStatValue}
        </div>
      )}

      {opt.source === "txline" && (
        <span className="mt-2 inline-block rounded-sm bg-signal/10 px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider text-signal">
          TxLINE
        </span>
      )}
    </button>
  );
}

// ─── Live match score banner ──────────────────────────────────────────────────

function ScoreBanner({ fixture, scores }: { fixture: TxFixture; scores: TxScoreEvent[] }) {
  const parsed = parseCurrentScore(scores);
  if (!parsed) return null;
  const { p1Goals, p2Goals, p1Corners, p2Corners, minutes, clockRunning, isFinished } = parsed;
  return (
    <div className={`mb-5 flex items-center justify-between rounded-xl border px-5 py-3.5 ${
      isFinished ? "border-line bg-ink-3/60" : "border-live/30 bg-live/8"
    }`}>
      <div className="flex items-center gap-5">
        <div className="text-center">
          <p className="font-mono text-[9px] uppercase tracking-wider text-text-dim">
            {fixture.Participant1.split(" ").slice(-1)}
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-text">{p1Goals}</p>
        </div>
        <div className="text-center">
          {isFinished ? (
            <span className="font-mono text-xs text-text-dim">FT</span>
          ) : clockRunning ? (
            <span className="flex items-center gap-1 font-mono text-xs text-live">
              <span className="size-1.5 animate-livedot rounded-full bg-live" />{minutes}&apos;
            </span>
          ) : (
            <span className="font-mono text-xs text-text-dim">HT</span>
          )}
          <p className="font-mono text-xs text-text-dim">·</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-[9px] uppercase tracking-wider text-text-dim">
            {fixture.Participant2.split(" ").slice(-1)}
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-text">{p2Goals}</p>
        </div>
      </div>
      <div className="hidden text-right sm:block">
        <p className="font-mono text-[9px] uppercase tracking-wider text-text-dim">Corners</p>
        <p className="font-mono text-sm tabular-nums text-text">{p1Corners} · {p2Corners}</p>
      </div>
    </div>
  );
}

// ─── Bet slip (right-side preview) ───────────────────────────────────────────

function BetSlip({
  opt, stake, pTrue, quoting, quote,
}: {
  opt: BetOption | null;
  stake: number;
  pTrue: number;
  quoting: boolean;
  quote: OraQuote | null;
}) {
  if (!opt) {
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center">
        <p className="text-sm text-text-dim">Select a bet above to see your slip</p>
      </div>
    );
  }

  const resolvedP = quote?.probabilityTrue ?? opt.pTrue ?? pTrue;
  const oraStake = computeOraStake(stake, resolvedP);
  const totalPot = stake + oraStake;
  const decOdds = totalPot / stake;

  return (
    <div className="rounded-xl border border-line bg-ink-2 font-mono text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3 text-[10px] uppercase tracking-wider">
        <span className="text-text-dim">Bet Slip</span>
        {opt.source === "txline" && (
          <span className="rounded-sm bg-signal/15 px-1.5 py-0.5 text-signal">TxLINE odds</span>
        )}
      </div>

      {/* Your pick */}
      <div className="border-b border-line px-5 py-4">
        <p className="text-[9px] uppercase tracking-wider text-text-dim mb-1">Your pick</p>
        <p className="text-base font-semibold text-text font-sans">{opt.label}</p>
        <p className="text-[10px] text-text-dim mt-0.5">{opt.sublabel}</p>
      </div>

      {/* Payout table */}
      <div className="px-5 py-4 space-y-2.5">
        <Row label="Your bet" value={`${fmtUsdc(stake)} USDC`} />
        <Row label="Odds" value={`${decOdds.toFixed(3)}×`} dim />
        <Row label="ORA bets against you" value={`${fmtUsdc(oraStake)} USDC`} dim />
        <div className="my-1 h-px bg-line" />
        <Row
          label={<span className="text-signal font-semibold">If you're right ✓</span>}
          value={<span className="text-signal font-bold">+{fmtUsdc(oraStake)} USDC</span>}
        />
        <Row
          label={<span className="text-live">If you're wrong ✗</span>}
          value={<span className="text-live">−{fmtUsdc(stake)} USDC</span>}
        />
      </div>

      {/* Probability bar */}
      {resolvedP != null && (
        <div className="border-t border-line px-5 py-3">
          <div className="mb-1.5 flex justify-between font-mono text-[9px] text-text-dim">
            <span>You win</span>
            <span>ORA wins</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink">
            <div
              className="h-full rounded-full bg-signal transition-all duration-500"
              style={{ width: `${Math.round(resolvedP * 100)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px]">
            <span className="text-signal">{fmtPct(resolvedP)}</span>
            <span className="text-text-dim">{fmtPct(1 - resolvedP)}</span>
          </div>
        </div>
      )}

      {/* Settlement footnote */}
      <div className="border-t border-line bg-ink-3/40 px-5 py-2.5 text-[9px] text-text-dim">
        Settled automatically on-chain · no admin decides this ·{" "}
        <span className="text-proof">validate_stat</span> proof
      </div>

      {/* ORA's take */}
      {(quoting || quote) && (
        <div className="border-t border-proof/20 bg-ink-3/30 px-5 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="size-3 text-proof shrink-0" />
            <span className="text-[9px] uppercase tracking-wider text-proof">ORA&apos;s take</span>
            {quoting && <Loader2 className="size-3 animate-spin text-text-dim ml-auto" />}
          </div>
          {quote && (
            <p className="text-[10px] leading-relaxed text-text-dim font-sans">{quote.stance}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label, value, dim,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${dim ? "text-text-dim" : "text-text"}`}>
      <span className="text-[10px]">{label}</span>
      <span className="tabular-nums text-[10px] text-right">{value}</span>
    </div>
  );
}

// ─── Group header ─────────────────────────────────────────────────────────────

function GroupLabel({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-dim">{icon}</span>
      <div>
        <p className="text-sm font-medium text-text">{title}</p>
        {sub && <p className="font-mono text-[9px] text-text-dim">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function BetCreator() {
  const params = useSearchParams();
  const fixtureId = Number(params.get("fixture"));
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const actions = useWhistlActions();

  const { data: fixturesData, error: fixturesError, isLoading: fixturesLoading } = useSWR(
    "/api/txline/fixtures", fetcher, { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const fixture: TxFixture | undefined = fixturesData?.fixtures?.find((f: TxFixture) => f.FixtureId === fixtureId);

  const { data: oddsData } = useSWR<{ ok: boolean; odds: TxOddsEntry[] }>(
    fixture ? `/api/txline/odds/${fixtureId}` : null, fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const { data: scoresData } = useSWR<{ ok: boolean; scores: TxScoreEvent[] }>(
    fixture ? `/api/txline/scores/${fixtureId}` : null, fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const p1 = fixture?.Participant1 ?? "Home";
  const p2 = fixture?.Participant2 ?? "Away";
  const odds = oddsData?.odds ?? [];
  const scores = scoresData?.scores ?? [];

  const finalStats = useMemo((): Record<string, number> | undefined => {
    if (!scores.length) return undefined;
    const withStats = scores.filter((e: TxScoreEvent) => e.Stats && Object.keys(e.Stats).length > 0);
    if (!withStats.length) return undefined;
    return withStats.reduce((a: TxScoreEvent, b: TxScoreEvent) => (b.Seq > a.Seq ? b : a)).Stats ?? undefined;
  }, [scores]);

  const options = useMemo(
    () => (fixture ? buildOptions(p1, p2, odds, finalStats) : []),
    [p1, p2, odds, finalStats, fixture],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = options.find((o) => o.id === selectedId) ?? options[0] ?? null;

  const [stake, setStake] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; pactId?: string; error?: string; oraStakeUsdc?: number } | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);

  const [quote, setQuote] = useState<OraQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const terms = selected?.terms;
  const pTrue = quote?.probabilityTrue ?? selected?.pTrue ?? 0.5;

  // Plain-English statement (e.g. "Canada to win", "Over 2.5 goals") for the slip + receipt.
  const statement = terms ? humanStatement(terms, p1, p2) : "";

  useEffect(() => {
    if (!terms || !Number.isFinite(fixtureId)) return;
    setQuoting(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/ora/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fixtureId, terms }),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (json?.ok) setQuote(json.quote as OraQuote);
      } catch { /* ignore aborts */ }
      finally { setQuoting(false); }
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [fixtureId, terms]);

  const matchIsFinished = useMemo(() => {
    if (!scores.length) return false;
    return parseCurrentScore(scores as TxScoreEvent[])?.isFinished ?? false;
  }, [scores]);

  async function handleFaucet() {
    setFaucetMsg("Minting…");
    const r = await actions.faucet();
    setFaucetMsg(r.ok ? "✓ 500 test-USDC added" : `Failed: ${r.error ?? "error"}`);
  }

  async function handleBet() {
    if (!fixture || stake <= 0 || !selected || !authenticated || !terms) return;
    setSubmitting(true);
    setResult(null);
    try {
      const pactId = BigInt(Date.now());
      setPhase("Locking your stake…");
      await actions.createPact({ pactId, fixtureId, stakeUsdc: stake, terms });

      setPhase("ORA taking the other side…");
      const acc = await fetch("/api/ora/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pactId: pactId.toString(),
          fixtureId,
          p1,
          p2,
          pact: {
            pactId: pactId.toString(),
            fixtureId,
            statement,
            terms,
            stakeUsdc: stake,
            baselinePTrue: pTrue,
          },
        }),
      }).then((r) => r.json()).catch(() => ({ ok: false }));
      if (!acc?.ok) throw new Error(acc?.error ?? "ORA could not accept this pact");

      // Best-effort DB mirror
      try {
        const token = await getAccessToken();
        await fetch("/api/pacts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            pact_id: pactId.toString(),
            fixture_id: fixtureId,
            competition: fixture.Competition,
            match_label: `${p1} vs ${p2}`,
            statement,
            terms,
            stake_usdc: stake,
            creator_wallet: actions.wallet?.address ?? null,
          }),
        });
      } catch { /* best-effort */ }

      setResult({
        ok: true,
        pactId: pactId.toString(),
        oraStakeUsdc: acc?.oraStakeUsdc,
      });
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setSubmitting(false);
      setPhase(null);
    }
  }

  // ── Loading / error states ───────────────────────────────────────────────────

  if (!ready || fixturesLoading || (!fixturesData && !fixturesError)) {
    return <Centered>Loading…</Centered>;
  }
  if (fixturesError?.code === "TXLINE_TOKEN_MISSING") {
    return <Centered>Live data unavailable. Set TXLINE_API_TOKEN and retry.</Centered>;
  }
  if (!fixture) {
    return (
      <Centered>
        Fixture #{fixtureId || "?"} not found.{" "}
        <Link className="text-signal" href="/matches">Back to markets</Link>
      </Centered>
    );
  }

  // ── Finished match ───────────────────────────────────────────────────────────

  if (matchIsFinished) {
    const parsed = parseCurrentScore(scores as TxScoreEvent[]);
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <BackLink />
        <MatchHeader p1={p1} p2={p2} fixture={fixture} />
        <div className="mt-8 rounded-xl border border-line bg-ink-2 p-8 text-center">
          <Flag className="mx-auto mb-4 size-8 text-text-dim" />
          <h2 className="text-lg font-semibold text-text">Match finished</h2>
          {parsed && (
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
              {parsed.p1Goals} · {parsed.p2Goals}
            </p>
          )}
          <p className="mt-3 text-sm text-text-dim">
            This match has ended · nothing left to predict. Browse upcoming matches instead.
          </p>
          {parsed && (
            <p className="mt-3 font-mono text-[10px] text-signal">
              ◉ Proof exists on-chain · open bets on this match auto-settle now
            </p>
          )}
          <Link
            href="/matches"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-ink hover:opacity-90"
          >
            Browse live markets <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ── Main creator layout ──────────────────────────────────────────────────────

  const groups: Array<{ key: BetOption["group"]; icon: React.ReactNode; title: string; sub?: string }> = [
    { key: "result", icon: <TrendingUp className="size-3.5" />, title: "Match result",
      sub: odds.length ? "From TxLINE sharp-book odds" : "Model estimate" },
    { key: "goals", icon: <Target className="size-3.5" />, title: "Total goals",
      sub: odds.length ? "From TxLINE O/U market" : "Model estimate" },
    { key: "stats", icon: <BarChart2 className="size-3.5" />, title: "Stats",
      sub: "Corners · Poisson model" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 py-8 sm:py-12">
      <BackLink />
      <MatchHeader p1={p1} p2={p2} fixture={fixture} />

      {/* Live score */}
      {scores.length > 0 && <div className="mt-5"><ScoreBanner fixture={fixture} scores={scores as TxScoreEvent[]} /></div>}

      <div className="mt-6 lg:grid lg:grid-cols-[1fr_340px] lg:gap-8">
        {/* ── Left: pick + stake ─────────────────────────────────────────── */}
        <div className="space-y-7">

          {/* Step 1 — pick */}
          <div>
            <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-text-dim">Step 1 · Choose your bet</p>
            <div className="space-y-5">
              {groups.map(({ key, icon, title, sub }) => {
                const group = options.filter((o) => o.group === key);
                if (!group.length) return null;
                return (
                  <div key={key} className="space-y-2.5">
                    <GroupLabel icon={icon} title={title} sub={sub} />
                    <div className={`grid gap-2.5 ${group.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                      {group.map((o) => (
                        <OptionCard
                          key={o.id}
                          opt={o}
                          selected={(selectedId ?? options[0]?.id) === o.id}
                          stake={stake}
                          onSelect={() => setSelectedId(o.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2 — stake */}
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-text-dim">Step 2 · How much?</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                step={1}
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="w-full rounded-md border border-line bg-ink-2 px-3 py-2.5 font-mono text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              />
              {[10, 25, 50, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStake(v)}
                  className={`shrink-0 rounded-md border px-3 py-2.5 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                    stake === v ? "border-signal bg-signal/10 text-signal" : "border-line text-text-dim hover:border-signal/40"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="mt-1.5 font-mono text-[9px] text-text-dim">USDC · test tokens on devnet</p>
          </div>

          {/* Faucet */}
          {authenticated && (
            <button
              type="button"
              onClick={handleFaucet}
              className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-text-dim transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <Coins className="size-4" />
              {faucetMsg ?? "Get 500 free test-USDC"}
            </button>
          )}

          {/* Bet slip — mobile only (shows below options) */}
          <div className="lg:hidden">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-text-dim">Your bet slip</p>
            <BetSlip opt={selected} stake={stake} pTrue={pTrue} quoting={quoting} quote={quote} />
          </div>

          {/* CTA */}
          <div className="space-y-3">
            {!authenticated ? (
              <button
                type="button"
                onClick={() => login()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-signal bg-signal/10 px-5 py-3.5 font-medium text-signal transition-colors hover:bg-signal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                <LogIn className="size-4" /> Sign in to place your bet
              </button>
            ) : (
              <button
                type="button"
                disabled={stake <= 0 || !selected || submitting}
                onClick={handleBet}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-signal px-5 py-3.5 text-base font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                {submitting ? (
                  <><Loader2 className="size-4 animate-spin" />{phase ?? "Placing…"}</>
                ) : (
                  <><ShieldCheck className="size-4" />Place bet · {fmtUsdc(stake)} USDC</>
                )}
              </button>
            )}

            {/* Result */}
            {result?.ok && (
              <div className="animate-rise rounded-xl border border-signal/30 bg-ink-2 p-5 space-y-3">
                <p className="text-sm font-medium text-text">
                  ✅ Bet placed on-chain
                  {result.oraStakeUsdc != null && (
                    <span className="text-text-dim font-normal">
                      {" "}· ORA countered with{" "}
                      <span className="text-signal">{fmtUsdc(result.oraStakeUsdc)} USDC</span>
                    </span>
                  )}
                </p>
                <p className="text-xs leading-relaxed text-text-dim">
                  Both stakes are locked in a Solana escrow. ORA Sentinel is watching
                  the match and will settle automatically the moment the outcome is decided.
                </p>
                <Link
                  href={`/ora?fixtureId=${fixtureId}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-proof/40 bg-proof/10 px-3 py-2 font-mono text-xs text-proof transition-colors hover:bg-proof/20"
                >
                  <CheckCircle2 className="size-3" />
                  Watch ORA Sentinel →
                </Link>
              </div>
            )}
            {result && !result.ok && (
              <div className="animate-rise rounded-xl border border-live/30 bg-live/5 p-4">
                <p className="text-sm text-live">✗ {result.error}</p>
              </div>
            )}
          </div>

          {/* How it works — simple explainer */}
          <div className="rounded-xl border border-line bg-ink-3/40 p-5 space-y-2.5 text-xs text-text-dim leading-relaxed">
            <p className="font-mono text-[9px] uppercase tracking-widest text-text-dim">How this works</p>
            <p>
              <span className="text-text">1. Your USDC locks in a Solana smart contract.</span>{" "}
              Nobody can touch it · not even us.
            </p>
            <p>
              <span className="text-text">2. ORA instantly takes the other side</span>{" "}
              based on real TxLINE match odds. The bet is live.
            </p>
            <p>
              <span className="text-text">3. When the match ends, a cryptographic proof from TxLINE settles it.</span>{" "}
              No admin, no dispute · math decides.
            </p>
          </div>
        </div>

        {/* ── Right: bet slip (desktop) ──────────────────────────────────── */}
        <div className="hidden lg:block">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-text-dim">Your bet slip</p>
          <div className="sticky top-6">
            <BetSlip opt={selected} stake={stake} pTrue={pTrue} quoting={quoting} quote={quote} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared tiny components ───────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/matches"
      className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm text-text-dim transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
    >
      <ArrowLeft className="size-4" /> Markets
    </Link>
  );
}

function MatchHeader({ p1, p2, fixture }: { p1: string; p2: string; fixture: TxFixture }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
        {fixture.Competition} · #{fixture.FixtureId}
      </p>
      <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
        {p1} <span className="text-text-dim">vs</span> {p2}
      </h1>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-1 items-center justify-center px-6 py-24 text-center text-sm text-text-dim">
      {children}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <BetCreator />
    </Suspense>
  );
}
