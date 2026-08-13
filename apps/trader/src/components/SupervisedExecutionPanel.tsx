"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock3,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import type { TradeProposal, TradingMandate } from "@/lib/supervision/domain";
import type { SupervisedMarket } from "@/lib/supervision/domain";
import { cn } from "@/lib/ui";

type SupervisionResponse = {
  ok: boolean;
  mandate?: TradingMandate;
  proposals?: TradeProposal[];
  environment?: "replay" | "devnet" | "txline_sandbox" | "sportmonks_sandbox";
  error?: string;
};

type Props = {
  getAccessToken: () => Promise<string | null>;
  onExecution?: () => void;
  onSnapshot?: (snapshot: { mandate: TradingMandate; proposals: TradeProposal[] }) => void;
};

const formatRemaining = (deadline: string, nowMs: number) => {
  const remaining = Math.max(0, Date.parse(deadline) - nowMs);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const MARKET_OPTIONS: Array<{ market: SupervisedMarket; label: string }> = [
  { market: "1x2", label: "Match winner" },
  { market: "goals_ou", label: "Goal totals" },
  { market: "btts", label: "BTTS" },
];

export default function SupervisedExecutionPanel({ getAccessToken, onExecution, onSnapshot }: Props) {
  const [mandate, setMandate] = useState<TradingMandate | null>(null);
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);
  const [scanSummary, setScanSummary] = useState<string | null>(null);

  const authenticatedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getAccessToken();
    if (!token) throw new Error("Your session expired. Please sign in again.");
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error ?? `Request failed with ${response.status}`);
    return body;
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    try {
      const body = await authenticatedFetch("/api/trader/supervision") as SupervisionResponse;
      const nextMandate = body.mandate ?? null;
      const nextProposals = body.proposals ?? [];
      setMandate(nextMandate);
      setProposals(nextProposals);
      if (nextMandate) onSnapshot?.({ mandate: nextMandate, proposals: nextProposals });
      setError(null);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, [authenticatedFetch, onSnapshot]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(initialRefresh);
  }, [refresh]);
  useEffect(() => {
    const clock = window.setInterval(() => setNowMs(Date.now()), 1000);
    const processor = window.setInterval(async () => {
      try {
        const result = await authenticatedFetch("/api/trader/proposals/process", { method: "POST", body: "{}" });
        if ((result.results ?? []).some((item: { status: string }) => item.status === "executed")) onExecution?.();
        if (result.checked > 0) await refresh();
      } catch {
        // The visible refresh path reports persistent errors. A transient background poll stays quiet.
      }
    }, 10_000);
    return () => { window.clearInterval(clock); window.clearInterval(processor); };
  }, [authenticatedFetch, onExecution, refresh]);

  const pending = useMemo(() => proposals.filter((proposal) => proposal.status === "pending"), [proposals]);

  async function save(next: TradingMandate) {
    setBusy("mandate");
    setSaved(false);
    try {
      const body = await authenticatedFetch("/api/trader/supervision", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setMandate(body.mandate);
      setSaved(true);
      setError(null);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function createOpportunity(mode: "live" | "replay" = "live") {
    if (!mandate) return;
    setBusy("create");
    try {
      const result = await authenticatedFetch("/api/trader/proposals", {
        method: "POST",
        headers: { "Idempotency-Key": `${mode}:${crypto.randomUUID()}` },
        body: JSON.stringify({ stake: Math.min(20, mandate.maxStake), mode: mode === "replay" ? "replay" : undefined }),
      });
      if (mode === "replay") setScanSummary("A practice pick is ready so you can try the full experience.");
      else if (result.proposal) {
        setScanSummary(`ORA checked ${result.scan.fixturesFound} games, compared ${result.scan.fixturesPriced}, and found one pick worth reviewing.`);
      } else {
        setScanSummary(`ORA checked ${result.scan.fixturesFound} games and compared ${result.scan.fixturesPriced}. None offered at least ${mandate.minEvPct}% value, so ORA did not force a pick.`);
      }
      await refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function decide(proposal: TradeProposal, action: "approve" | "decline" | "change_stake", stake?: number) {
    setBusy(`${proposal.id}:${action}`);
    try {
      await authenticatedFetch(`/api/trader/proposals/${proposal.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ action, stake }),
      });
      await refresh();
      if (action === "approve") onExecution?.();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!mandate) {
    return (
      <section className="telemetry-panel terminal-supervision p-5">
        <div className="flex items-center gap-3 text-sm font-bold text-[#50465f]">
          <Loader2 className="size-4 animate-spin text-[#8059e8]" /> Loading your ORA settings
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </section>
    );
  }

  return (
    <section className="telemetry-panel terminal-supervision p-4 sm:p-5" aria-labelledby="supervised-execution-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8059e8]">
            <ShieldCheck className="size-3.5" /> Your ORA settings
          </div>
          <h2 id="supervised-execution-title" className="mt-2 text-xl font-black tracking-[-0.03em]">You remain in control.</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#756d82]">
            ORA can suggest a pick, but your saved limits stay in control. Approve it now, decline it, or let the five-minute timer finish when auto-pick is on.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#f0d7a8] bg-[#fff8e9] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8a6c38]">
          Practice mode
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <NumberField label="Most per pick" value={mandate.maxStake} suffix="credits" onChange={(maxStake) => setMandate({ ...mandate, maxStake })} />
        <NumberField label="Most per day" value={mandate.maxDailyStake} suffix="credits" onChange={(maxDailyStake) => setMandate({ ...mandate, maxDailyStake })} />
        <NumberField label="Minimum value" value={mandate.minEvPct} suffix="%" step={0.5} onChange={(minEvPct) => setMandate({ ...mandate, minEvPct })} />
        <NumberField label="Allowed price change" value={mandate.maxOddsDriftPct} suffix="%" step={0.5} onChange={(maxOddsDriftPct) => setMandate({ ...mandate, maxOddsDriftPct })} />
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a8295]">Types of picks ORA may suggest</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MARKET_OPTIONS.map((option) => {
            const enabled = mandate.allowedMarkets.includes(option.market);
            return <button
              key={option.market}
              type="button"
              disabled={busy != null || mandate.killed}
              onClick={() => setMandate({
                ...mandate,
                allowedMarkets: enabled
                  ? mandate.allowedMarkets.filter((market) => market !== option.market)
                  : [...mandate.allowedMarkets, option.market],
              })}
              className={cn(
                "rounded-full border px-3 py-2 text-[11px] font-bold transition disabled:opacity-50",
                enabled ? "border-[#8059e8] bg-[#eee8ff] text-[#6847c5]" : "border-[#d9d0e7] bg-white text-[#8a8295]",
              )}
            >
              {enabled ? "✓ " : ""}{option.label}
            </button>;
          })}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-[#8a8295]">ORA will only suggest the types you choose here.</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={mandate.killed || busy != null}
          onClick={() => void save({ ...mandate, autoExecute: !mandate.autoExecute, paused: false })}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition",
            mandate.autoExecute ? "bg-[#21172f] text-white" : "border border-[#d9d0e7] bg-white text-[#50465f]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {mandate.autoExecute ? <Check className="size-3.5" /> : <Play className="size-3.5" />}
          Auto-pick {mandate.autoExecute ? "on" : "off"}
        </button>
        <button
          type="button"
          disabled={mandate.killed || busy != null}
          onClick={() => void save({ ...mandate, paused: !mandate.paused })}
          className="inline-flex items-center gap-2 rounded-full border border-[#d9d0e7] bg-white px-4 py-2.5 text-xs font-bold text-[#50465f] disabled:opacity-50"
        >
          {mandate.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          {mandate.paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void save(mandate)}
          className="inline-flex items-center gap-2 rounded-full bg-[#eee8ff] px-4 py-2.5 text-xs font-bold text-[#6847c5] disabled:opacity-50"
        >
          {busy === "mandate" ? <Loader2 className="size-3.5 animate-spin" /> : saved ? <Check className="size-3.5" /> : <RefreshCw className="size-3.5" />}
          {saved ? "Saved" : "Save settings"}
        </button>
        {!confirmKill ? (
          <button type="button" disabled={mandate.killed || busy != null} onClick={() => setConfirmKill(true)} className="ml-auto inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-40">
            <Square className="size-3" /> Stop ORA
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-2">
            <span className="px-1 text-[10px] font-bold text-red-700">This cannot be undone</span>
            <button type="button" onClick={() => void save({ ...mandate, killed: true })} className="rounded-full bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white">Confirm stop</button>
            <button type="button" onClick={() => setConfirmKill(false)} className="rounded-full px-2 py-1.5 text-[10px] font-bold text-red-700">Cancel</button>
          </div>
        )}
      </div>

      {mandate.killed && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> ORA has been stopped. It cannot place or prepare any new picks.
        </div>
      )}
      {error && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <div className="mt-6 flex items-center justify-between border-t border-[#eee8f3] pt-5">
        <div>
          <p className="text-sm font-black">Suggested picks</p>
          <p className="text-[11px] text-[#8a8295]">{pending.length} awaiting your decision</p>
        </div>
        <button id="run-ora-scan" type="button" disabled={busy != null || mandate.killed || mandate.paused} onClick={() => void createOpportunity()} className="inline-flex items-center gap-2 rounded-full bg-[#21172f] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
          {busy === "create" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          Find picks
        </button>
      </div>

      {scanSummary && <div role="status" className="mt-3 rounded-xl border border-[#d9d0e7] bg-[#f7f4fa] px-3 py-2 text-[10px] leading-4 text-[#756d82]">{scanSummary}</div>}

      <div className="mt-3 space-y-3">
        {proposals.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#d9d0e7] p-5 text-center text-xs text-[#8a8295]">
            No suggestions yet. Ask ORA to check today’s games.
            <button type="button" disabled={busy != null || mandate.killed} onClick={() => void createOpportunity("replay")} className="ml-2 font-bold text-[#6847c5] underline underline-offset-2 disabled:opacity-50">Try a practice example</button>
          </div>
        )}
        {proposals.slice(0, 5).map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} nowMs={nowMs} busy={busy} onDecide={decide} />
        ))}
      </div>
    </section>
  );
}

function NumberField({ label, value, suffix, step = 1, onChange }: { label: string; value: number; suffix: string; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="rounded-2xl bg-[#f7f4fa] p-3">
      <span className="block text-[9px] font-bold uppercase tracking-wider text-[#8a8295]">{label}</span>
      <span className="mt-1 flex items-end gap-1">
        <input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="min-w-0 flex-1 bg-transparent text-lg font-black tabular-nums outline-none" />
        <span className="pb-0.5 text-[9px] text-[#8a8295]">{suffix}</span>
      </span>
    </label>
  );
}

function ProposalCard({ proposal, nowMs, busy, onDecide }: {
  proposal: TradeProposal;
  nowMs: number | null;
  busy: string | null;
  onDecide: (proposal: TradeProposal, action: "approve" | "decline" | "change_stake", stake?: number) => Promise<void>;
}) {
  const [stake, setStake] = useState(proposal.stake);
  const isPending = proposal.status === "pending";
  const remaining = nowMs === null ? "5:00" : formatRemaining(proposal.decisionDeadlineAt, nowMs);
  return (
    <article className="rounded-2xl border border-[#e6deed] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black">{proposal.match}</p>
            <StatusPill status={proposal.status} />
          </div>
          <p className="mt-1 text-[11px] text-[#756d82]">
            {proposal.selection} at {proposal.quotedOdds.toFixed(2)}. ORA gives it a {proposal.predictedProbabilityPct}% chance, compared with the market’s {proposal.marketProbabilityPct}%. Value advantage: +{proposal.evPct}%.
          </p>
        </div>
        {isPending && (
          <div className="flex shrink-0 items-center gap-2 rounded-full bg-[#fff8e9] px-3 py-2 text-xs font-black tabular-nums text-[#8a6c38]">
            <Clock3 className="size-3.5" /> {remaining}
          </div>
        )}
      </div>

      {isPending ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-full border border-[#d9d0e7] bg-[#faf8fc] px-3 py-2 text-[10px] font-bold text-[#756d82]">
            Amount
            <input type="number" min="0.01" step="0.01" value={stake} onChange={(event) => setStake(Number(event.target.value))} className="w-16 bg-transparent text-right text-xs font-black text-[#21172f] outline-none" />
          </label>
          {stake !== proposal.stake && <button type="button" disabled={busy != null} onClick={() => void onDecide(proposal, "change_stake", stake)} className="rounded-full bg-[#eee8ff] px-3 py-2 text-[10px] font-bold text-[#6847c5]">Save stake</button>}
          <button type="button" disabled={busy != null} onClick={() => void onDecide(proposal, "approve")} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#21172f] px-4 py-2 text-[10px] font-bold text-white disabled:opacity-50">
            {busy === `${proposal.id}:approve` ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Approve now
          </button>
          <button type="button" disabled={busy != null} onClick={() => void onDecide(proposal, "decline")} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-[10px] font-bold text-red-600 disabled:opacity-50">
            <X className="size-3" /> Decline
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-[#f7f4fa] px-3 py-2 text-[10px] leading-4 text-[#756d82]">
          {proposal.decisionReason ?? "Proposal lifecycle complete."}
          {proposal.executionRef && <span className="ml-1 text-[#6847c5]">Saved in your history.</span>}
        </div>
      )}
    </article>
  );
}

function StatusPill({ status }: { status: TradeProposal["status"] }) {
  const positive = status === "executed";
  const warning = status === "pending" || status === "executing";
  return <span className={cn("rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider", positive ? "bg-emerald-100 text-emerald-700" : warning ? "bg-amber-100 text-amber-700" : "bg-[#f0edf3] text-[#756d82]")}>{status}</span>;
}
