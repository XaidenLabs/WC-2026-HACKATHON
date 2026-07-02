"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import { usePrivy } from "@privy-io/react-auth";
import {
  ArrowLeft, Trophy, TrendingDown, Clock, Ban, LogIn, RefreshCw,
  ShieldCheck, ExternalLink, Loader2, Zap, ChevronDown,
} from "lucide-react";
import { humanStatement, splitMatchLabel } from "@/lib/bet-statement";

// ─── Stat helpers ─────────────────────────────────────────────────────────────

const STAT_NAME: Record<number, string> = {
  1: "Goals (home)", 2: "Goals (away)",
  3: "Yellow cards (home)", 4: "Yellow cards (away)",
  5: "Red cards (home)", 6: "Red cards (away)",
  7: "Corners (home)", 8: "Corners (away)",
};
const COMPARE_SYM: Record<number, string> = { 0: ">", 1: "<", 2: "=" };
const OP_WORD: Record<number, string> = { 0: "combined", 1: "margin" };
const PERIOD_LABEL: Record<number, string> = { 0: "Full match", 1: "1st half", 2: "2nd half" };

function describeTerms(terms: PactRow["terms"]): string {
  if (!terms) return "—";
  const { statAKey, statBKey, hasStatB } = terms;
  const a = STAT_NAME[statAKey] ?? `stat ${statAKey}`;
  if (!hasStatB || !statBKey) return a;
  const b = STAT_NAME[statBKey] ?? `stat ${statBKey}`;
  return `${a} & ${b}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PactRow = {
  id: string;
  pact_id: string;
  fixture_id: number;
  competition: string | null;
  match_label: string | null;
  statement: string;
  terms: {
    statAKey: number; statBKey?: number; hasStatB?: boolean;
    statAPeriod?: number; threshold?: number; comparison?: number; op?: number | null;
  } | null;
  stake_usdc: number;
  creator_did: string;
  status: "created" | "accepted" | "settled" | "cancelled";
  winner_did: string | null;
  created_at: string;
  settle_tx_sig: string | null;
  predicate_result: boolean | null;
  final_value: number | null;
};

type DisplayStatus = "active" | "won" | "lost" | "cancelled" | "settled";
type Filter = "all" | "active" | "won" | "lost";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function displayStatus(pact: PactRow, userDid: string): DisplayStatus {
  if (pact.status === "settled") {
    if (pact.winner_did === userDid) return "won";
    if (pact.winner_did != null) return "lost";
    return "settled";
  }
  if (pact.status === "created" || pact.status === "accepted") return "active";
  return "cancelled";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function shortSig(sig: string): string {
  return `${sig.slice(0, 8)}…${sig.slice(-6)}`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const BADGE: Record<DisplayStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  active:    { label: "ACTIVE",    cls: "text-signal  border-signal/30  bg-signal/8",   Icon: Clock       },
  won:       { label: "WON",       cls: "text-win     border-win/30     bg-win/8",      Icon: Trophy      },
  lost:      { label: "LOST",      cls: "text-lose    border-lose/30    bg-lose/8",     Icon: TrendingDown },
  settled:   { label: "SETTLED",   cls: "text-text-dim border-line      bg-ink-3",      Icon: ShieldCheck },
  cancelled: { label: "VOID",      cls: "text-text-dim border-line      bg-ink-3",      Icon: Ban         },
};

function StatusBadge({ ds }: { ds: DisplayStatus }) {
  const { label, cls, Icon } = BADGE[ds];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-widest ${cls}`}>
      <Icon className="size-2.5" aria-hidden />
      {label}
    </span>
  );
}

// ─── Proof receipt ─────────────────────────────────────────────────────────────

function ProofReceipt({ pact, userDid }: { pact: PactRow; userDid: string }) {
  const ds = displayStatus(pact, userDid);
  const isWin = ds === "won";
  const txSig = pact.settle_tx_sig;
  const hasTx = Boolean(txSig);

  return (
    <div className={`mt-3 rounded-lg border px-3 py-2.5 font-mono text-[10px] ${
      isWin ? "border-win/30 bg-win/5" : "border-line bg-ink"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="flex items-center gap-1.5 text-text-dim">
          <ShieldCheck className="size-3 text-proof" aria-hidden />
          settled by <span className="text-proof">validate_stat</span> proof
        </span>
        {pact.predicate_result != null && (
          <span className={pact.predicate_result ? "text-win" : "text-lose"}>
            predicate = {pact.predicate_result ? "TRUE ✓" : "FALSE ✗"}
          </span>
        )}
      </div>
      {pact.final_value != null && (
        <div className="text-text-dim mb-1">
          final value: <span className="text-text">{pact.final_value}</span>
        </div>
      )}
      {hasTx ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-dim">
            tx: <span className="text-text">{shortSig(txSig!)}</span>
          </span>
          <a
            href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-signal hover:underline"
          >
            explorer <ExternalLink className="size-2.5" aria-hidden />
          </a>
        </div>
      ) : (
        <span className="text-text-dim/60">no oracle, no admin · proof verified on-chain</span>
      )}
    </div>
  );
}

// ─── Settle button ─────────────────────────────────────────────────────────────

function SettleButton({ pact, onSettled }: { pact: PactRow; onSettled: () => void }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{ demo: boolean; explorerUrl?: string; isTrue?: boolean } | null>(null);

  async function handleSettle() {
    setState("loading");
    try {
      const res = await fetch("/api/ora/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pactId: pact.pact_id,
          fixtureId: pact.fixture_id,
          statAKey: pact.terms?.statAKey ?? 1,
          ...(pact.terms?.hasStatB ? { statBKey: pact.terms.statBKey } : {}),
          terms: pact.terms,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setResult({ demo: !!j.demo, explorerUrl: j.explorerUrl, isTrue: j.isTrue });
        setState("done");
        setTimeout(onSettled, 2000);
      } else {
        setState("error");
        setErrorMsg(j.error ?? "Settlement failed");
      }
    } catch (e) {
      setState("error");
      setErrorMsg((e as Error).message);
    }
  }

  if (state === "done" && result) {
    const won = result.isTrue === true;
    const lost = result.isTrue === false;
    return (
      <div className="mt-3 space-y-1">
        <div className={`flex items-center gap-2 font-mono text-xs ${won ? "text-win" : lost ? "text-lose" : "text-text-dim"}`}>
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          {won ? "WON — predicate TRUE ✓" : lost ? "LOST — predicate FALSE ✗" : "Settled"}
        </div>
        {result.demo ? (
          <p className="font-mono text-[10px] text-text-dim">
            verified via TxLINE Merkle proof · result recorded
          </p>
        ) : result.explorerUrl ? (
          <a
            href={result.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[10px] text-signal hover:underline"
          >
            view on explorer <ExternalLink className="size-2.5" aria-hidden />
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {state === "error" && (
        <p className="mb-2 font-mono text-[10px] text-live">{errorMsg}</p>
      )}
      <button
        type="button"
        onClick={handleSettle}
        disabled={state === "loading"}
        className="inline-flex items-center gap-2 rounded-md border border-signal/30 bg-signal/8 px-3 py-1.5 font-mono text-xs text-signal transition-colors hover:bg-signal/15 disabled:opacity-60"
      >
        {state === "loading" ? (
          <><Loader2 className="size-3 animate-spin" aria-hidden /> Settling…</>
        ) : (
          <><Zap className="size-3" aria-hidden /> Settle via ORA</>
        )}
      </button>
      <p className="mt-1 font-mono text-[10px] text-text-dim">
        ORA fetches TxLINE Merkle proof · evaluates predicate · records result
      </p>
    </div>
  );
}

// ─── Bet card ─────────────────────────────────────────────────────────────────

function BetCard({ pact, userDid, onMutate }: { pact: PactRow; userDid: string; onMutate: () => void }) {
  const [open, setOpen] = useState(false);
  const ds = displayStatus(pact, userDid);
  const payout = pact.stake_usdc * 2;
  const canSettle = pact.status === "accepted" || pact.status === "created";

  const t = pact.terms;
  const [p1Name, p2Name] = splitMatchLabel(pact.match_label);
  // Plain-English statement derived from terms — also cleans up older pacts that
  // saved the raw predicate string.
  const readable   = t ? humanStatement(t, p1Name, p2Name) : pact.statement;
  const statDesc   = describeTerms(t);
  const period     = t?.statAPeriod != null ? (PERIOD_LABEL[t.statAPeriod] ?? `Period ${t.statAPeriod}`) : null;
  const comparison = t?.comparison != null ? COMPARE_SYM[t.comparison] : null;
  const threshold  = t?.threshold ?? null;
  const opWord     = t?.op != null ? OP_WORD[t.op] : null;

  return (
    <article className={`relative overflow-hidden rounded-xl border bg-ink-2 transition-colors ${
      ds === "won"  ? "border-win/30"  :
      ds === "lost" ? "border-lose/30" :
      "border-line hover:border-line/80"
    }`}>
      {/* Watermark stamp */}
      {(ds === "won" || ds === "lost") && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
          <span
            className="rotate-[-22deg] text-[5.5rem] font-black uppercase leading-none tracking-widest"
            style={{ opacity: 0.09, color: ds === "won" ? "var(--color-win)" : "#ef4444" }}
          >
            {ds === "won" ? "WON" : "LOST"}
          </span>
        </div>
      )}
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-inset rounded-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
              {pact.competition ?? "World Cup"} · <span className="text-text-dim/70">#{String(pact.pact_id).slice(-8)}</span>
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-text">
              {pact.match_label ?? `Fixture #${pact.fixture_id}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge ds={ds} />
            <ChevronDown
              className={`size-4 text-text-dim transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </div>
        </div>

        {/* Statement */}
        <div className="mb-4 rounded-md border border-line/60 bg-ink px-3 py-2.5 text-left">
          <p className="font-mono text-xs text-text">{readable}</p>
          <p className="mt-1 font-mono text-[10px] text-text-dim">
            {ds === "active" ? "wins if TRUE at full time" :
             ds === "won"    ? "✓ predicate was TRUE" :
             ds === "lost"   ? "✗ predicate was FALSE" :
                               "match ended"}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-dim">Staked</p>
            <p className="text-text">{pact.stake_usdc.toFixed(2)} USDC</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-dim">
              {ds === "won" ? "Won" : ds === "lost" ? "Lost" : "To win"}
            </p>
            <p className={ds === "won" ? "text-win" : ds === "lost" ? "text-lose" : "text-text"}>
              {ds === "won"
                ? `+${payout.toFixed(2)} USDC`
                : ds === "lost"
                ? `-${pact.stake_usdc.toFixed(2)} USDC`
                : `${payout.toFixed(2)} USDC`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-text-dim">Placed</p>
            <p className="text-text-dim">{relativeTime(pact.created_at)}</p>
          </div>
        </div>
      </button>

      {/* Expandable detail panel */}
      {open && (
        <div className="border-t border-line/60 px-5 pb-5">
          <div className="mt-4 rounded-lg border border-line bg-ink p-4 space-y-3 font-mono text-xs">
            <p className="text-[10px] uppercase tracking-widest text-text-dim mb-3">Bet details</p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <div>
                <p className="text-[10px] text-text-dim uppercase tracking-wider">Fixture</p>
                <p className="text-text mt-0.5">{pact.match_label ?? `#${pact.fixture_id}`}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-dim uppercase tracking-wider">Period</p>
                <p className="text-text mt-0.5">{period ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-dim uppercase tracking-wider">Stat tracked</p>
                <p className="text-text mt-0.5">{statDesc}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-dim uppercase tracking-wider">Condition</p>
                <p className="text-text mt-0.5">
                  {opWord ? `${opWord} ` : ""}
                  {comparison && threshold != null ? `${comparison} ${threshold}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-text-dim uppercase tracking-wider">Pact ID</p>
                <p className="text-text mt-0.5 break-all">{pact.pact_id}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-dim uppercase tracking-wider">Counterparty</p>
                <p className="text-text mt-0.5">
                  {pact.status === "created" ? "Awaiting ORA" : "ORA"}
                </p>
              </div>
            </div>
          </div>

          {/* Proof receipt for settled pacts */}
          {(ds === "won" || ds === "lost" || ds === "settled") && (
            <ProofReceipt pact={pact} userDid={userDid} />
          )}

          {/* Settle button */}
          {canSettle && (
            <SettleButton pact={pact} onSettled={onMutate} />
          )}
        </div>
      )}

      {/* Always-visible proof/settle when collapsed (so users notice the action) */}
      {!open && (ds === "won" || ds === "lost" || ds === "settled") && (
        <div className="border-t border-line/60 px-5 pb-4">
          <ProofReceipt pact={pact} userDid={userDid} />
        </div>
      )}
      {!open && canSettle && (
        <div className="border-t border-line/60 px-5 pb-4">
          <SettleButton pact={pact} onSettled={onMutate} />
        </div>
      )}
    </article>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "all",    label: "All" },
  { id: "won",    label: "Won" },
  { id: "lost",   label: "Lost" },
];

// ─── Empty state ──────────────────────────────────────────────────────────────

const EMPTY: Record<Filter, { heading: string; sub: string }> = {
  all:    { heading: "No bets yet",         sub: "Create your first pact from the Markets page." },
  active: { heading: "No active bets",      sub: "Open pacts waiting for the final whistle." },
  won:    { heading: "No wins yet",         sub: "Your winning pacts will appear here." },
  lost:   { heading: "No losses on record", sub: "Pacts you lost will show here." },
};

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ pacts, userDid }: { pacts: PactRow[]; userDid: string }) {
  const stats = useMemo(() => {
    let active = 0, won = 0, lost = 0, wonUsdc = 0, lostUsdc = 0;
    for (const p of pacts) {
      const ds = displayStatus(p, userDid);
      if (ds === "active") { active++; }
      if (ds === "won")    { won++;  wonUsdc  += p.stake_usdc * 2; }
      if (ds === "lost")   { lost++; lostUsdc += p.stake_usdc; }
    }
    return { active, won, lost, wonUsdc, lostUsdc };
  }, [pacts, userDid]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: "Total bets",  value: String(pacts.length),           sub: "placed" },
        { label: "Active",      value: String(stats.active),           sub: "in play" },
        { label: "Won",         value: `+${stats.wonUsdc.toFixed(0)}`, sub: `${stats.won} pact${stats.won !== 1 ? "s" : ""}`, highlight: "win" },
        { label: "Lost",        value: `-${stats.lostUsdc.toFixed(0)}`,sub: `${stats.lost} pact${stats.lost !== 1 ? "s" : ""}`, highlight: "lose" },
      ].map(({ label, value, sub, highlight }) => (
        <div key={label} className="rounded-xl border border-line bg-ink-2 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">{label}</p>
          <p className={`mt-1 font-mono text-xl tabular-nums ${highlight === "win" ? "text-win" : highlight === "lose" ? "text-lose" : "text-text"}`}>
            {value}
          </p>
          <p className="font-mono text-[10px] text-text-dim">{sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BetsPage() {
  const { ready, authenticated, user, login, getAccessToken } = usePrivy();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, error, mutate } = useSWR(
    authenticated ? "/api/pacts/me" : null,
    async (url: string) => {
      const token = await getAccessToken();
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      return j as { ok: boolean; pacts: PactRow[] };
    },
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );

  const userDid = user?.id ?? "";
  const allPacts: PactRow[] = data?.pacts ?? [];

  // Auto-settle: attempt to settle every active pact on page load (and on each 30s poll).
  // The fulfill route fetches the TxLINE proof first — if the match isn't over the proof
  // API returns 422 with matchNotFinished=true and nothing on-chain is touched.
  const autoSettled = useRef(new Set<string>());
  useEffect(() => {
    if (!authenticated || !allPacts.length) return;
    const pending = allPacts.filter(
      (p) => (p.status === "created" || p.status === "accepted") && !autoSettled.current.has(p.pact_id),
    );
    if (!pending.length) return;

    for (const pact of pending) {
      autoSettled.current.add(pact.pact_id);
      fetch("/api/ora/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pactId: pact.pact_id,
          fixtureId: pact.fixture_id,
          statAKey: pact.terms?.statAKey ?? 1,
          ...(pact.terms?.hasStatB ? { statBKey: pact.terms.statBKey } : {}),
          terms: pact.terms,
        }),
      })
        .then((r) => r.json())
        .then((result) => {
          // matchNotFinished=true is expected for live bets — not an error, just skip.
          if (result.ok) mutate();
          else if (!result.matchNotFinished) {
            // Unexpected error — remove from set so we retry next poll.
            autoSettled.current.delete(pact.pact_id);
          }
        })
        .catch(() => { autoSettled.current.delete(pact.pact_id); });
    }
  }, [allPacts, authenticated, mutate]);

  const filtered = useMemo(() => {
    if (filter === "all") return allPacts;
    return allPacts.filter((p) => {
      const ds = displayStatus(p, userDid);
      if (filter === "active") return ds === "active";
      if (filter === "won")    return ds === "won";
      if (filter === "lost")   return ds === "lost";
      return true;
    });
  }, [allPacts, filter, userDid]);

  if (!ready) {
    return (
      <div className="mx-auto flex max-w-2xl flex-1 items-center justify-center py-24">
        <div className="size-5 animate-spin rounded-full border-2 border-line border-t-signal" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <div className="rounded-full border border-line bg-ink-2 p-4">
          <Trophy className="size-8 text-signal" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text">Sign in to see your bets</h1>
          <p className="mt-2 text-sm text-text-dim">Your placed pacts, wins, and losses — all in one place.</p>
        </div>
        <button
          type="button"
          onClick={() => login()}
          className="inline-flex items-center gap-2 rounded-md bg-signal px-5 py-2.5 font-medium text-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <LogIn className="size-4" aria-hidden /> Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 animate-rise">
      <Link
        href="/matches"
        className="mb-8 inline-flex items-center gap-2 rounded-md text-sm text-text-dim transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <ArrowLeft className="size-4" aria-hidden /> Markets
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">Account</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-text">Your Bets</h1>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          disabled={isLoading}
          title="Refresh"
          className="rounded-lg border border-line bg-ink-2 p-2 text-text-dim transition-colors hover:bg-ink-3 hover:text-text disabled:opacity-40"
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden />
        </button>
      </div>

      {allPacts.length > 0 && (
        <div className="mb-6">
          <SummaryBar pacts={allPacts} userDid={userDid} />
        </div>
      )}

      <div className="mb-6 flex gap-1 rounded-lg border border-line bg-ink-2 p-1">
        {FILTERS.map(({ id, label }) => {
          const count = id === "all"
            ? allPacts.length
            : allPacts.filter((p) => {
                const ds = displayStatus(p, userDid);
                return (id === "active" && ds === "active") ||
                       (id === "won"    && ds === "won")    ||
                       (id === "lost"   && ds === "lost");
              }).length;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                filter === id
                  ? "bg-ink-3 text-text shadow-sm"
                  : "text-text-dim hover:text-text"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                  filter === id ? "bg-line text-text" : "bg-ink-3 text-text-dim"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && !data && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl border border-line bg-ink-2" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-live/30 bg-ink-2 p-5 text-sm text-live">
          Failed to load bets: {error.message}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-full border border-line bg-ink-2 p-4">
            <Trophy className="size-8 text-text-dim" aria-hidden />
          </div>
          <div>
            <p className="font-semibold text-text">{EMPTY[filter].heading}</p>
            <p className="mt-1 text-sm text-text-dim">{EMPTY[filter].sub}</p>
          </div>
          {filter === "all" && (
            <Link
              href="/matches"
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
            >
              Browse markets
            </Link>
          )}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((pact) => (
            <BetCard key={pact.id} pact={pact} userDid={userDid} onMutate={mutate} />
          ))}
        </div>
      )}
    </div>
  );
}
