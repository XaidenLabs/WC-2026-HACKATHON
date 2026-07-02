"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  Zap, Activity, SquareTerminal, Play, Sparkles, ShieldCheck, Loader2,
  TrendingUp, TrendingDown, Cpu, ArrowRight, Radio, Send, ExternalLink,
} from "lucide-react";
import { LineChart, Line, YAxis, XAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BacktestSummary, StrategySpec } from "@/lib/agent/strategy";
import { actionText, conditionText, oddsLabel, selectionShort, sideVerb } from "@/lib/agent/humanize";

function cn(...i: ClassValue[]) {
  return twMerge(clsx(i));
}
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// "Today 18:00" / "Tomorrow 21:00" / "12 Jul 18:00" for upcoming kickoffs.
function kickoff(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

type LogType = "info" | "warn" | "exec" | "success" | "error";
type Log = { time: string; msg: string; type: LogType };

const EXAMPLES = [
  "Back the underdog to win when their odds shorten more than 8% before kickoff — the market is telling me something.",
  "Lay the favourite whenever they're priced above 65%. Fade the public.",
  "Back the home team whenever they're a live underdog below 35% implied.",
];


export default function TradingDesk() {
  // ── Live market universe (real TxLINE fixtures) ──────────────────────────────
  const { data: fxData, error: fxError } = useSWR<{ ok: boolean; fixtures: { FixtureId: number; Participant1: string; Participant2: string; StartTime: number; Competition: string }[]; error?: string }>(
    "/api/txline/fixtures", fetcher, { refreshInterval: 60_000 },
  );
  const marketsError = Boolean(fxError) || (fxData && fxData.ok === false);
  const markets = useMemo(() => {
    const now = Date.now();
    const LIVE_MS = 2.5 * 3600e3;
    return (fxData?.fixtures ?? [])
      .map((f) => ({
        ...f,
        phase: (now < f.StartTime ? "upcoming" : now < f.StartTime + LIVE_MS ? "live" : "finished") as
          | "upcoming" | "live" | "finished",
      }))
      .filter((f) => f.phase !== "finished") // finished games can't be traded — exclude them
      .sort((a, b) => Number(b.phase === "live") - Number(a.phase === "live") || a.StartTime - b.StartTime)
      .slice(0, 12);
  }, [fxData]);

  // ── Terminal ─────────────────────────────────────────────────────────────────
  // Seed with static lines (no Date → no hydration mismatch) so the terminal is never blank,
  // even before client JS hydrates.
  const [logs, setLogs] = useState<Log[]>([
    { time: "--:--:--", msg: "TxAgent runtime online.", type: "info" },
    { time: "--:--:--", msg: "Connecting to TxLINE decentralized feed…", type: "info" },
  ]);
  const logEnd = useRef<HTMLDivElement>(null);
  const addLog = (msg: string, type: LogType = "info") =>
    setLogs((p) => [...p, { time: new Date().toLocaleTimeString(), msg, type }]);
  useEffect(() => {
    setLogs([
      { time: new Date().toLocaleTimeString(), msg: "TxAgent runtime online.", type: "info" },
      { time: new Date().toLocaleTimeString(), msg: "TxLINE decentralized feed connected · World Cup 2026.", type: "success" },
      { time: new Date().toLocaleTimeString(), msg: "Describe a strategy in plain English to begin.", type: "info" },
    ]);
  }, []);
  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // ── Strategy compose + compile ───────────────────────────────────────────────
  const [text, setText] = useState("");
  const [spec, setSpec] = useState<StrategySpec | null>(null);
  const [compiling, setCompiling] = useState(false);

  async function compile() {
    if (!text.trim() || compiling) return;
    setCompiling(true);
    setSpec(null);
    setBacktest(null);
    addLog("Compiling natural-language strategy via ACE (gpt-4o-mini)…", "exec");
    try {
      const r = await fetch("/api/agent/compile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json();
      if (!j.ok) { addLog("Compile failed: " + j.error, "error"); return; }
      setSpec(j.spec);
      addLog(`✓ Compiled "${j.spec.name}" — ${j.source === "ace" ? "ACE" : "heuristic"}. Ready to backtest.`, "success");
    } catch (e) {
      addLog("Compile error: " + (e as Error).message, "error");
    } finally {
      setCompiling(false);
    }
  }

  // ── Backtest ─────────────────────────────────────────────────────────────────
  const [backtest, setBacktest] = useState<(BacktestSummary & { matchesScanned: number }) | null>(null);
  const [testing, setTesting] = useState(false);

  async function runBacktest() {
    if (!spec || testing) return;
    setTesting(true);
    addLog("Replaying strategy over real World Cup match data (Merkle-verified)…", "exec");
    try {
      const r = await fetch("/api/agent/backtest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const j = await r.json();
      if (!j.ok) { addLog("Backtest failed: " + j.error, "error"); return; }
      setBacktest({ ...j.summary, matchesScanned: j.matchesScanned });
      const s = j.summary;
      addLog(
        `✓ Backtest complete · ${s.count} bets across ${j.matchesScanned} matches · ${(s.winRate * 100).toFixed(0)}% won · profit ${s.pnl > 0 ? "+" : ""}${s.pnl} USDC`,
        s.pnl >= 0 ? "success" : "warn",
      );
    } catch (e) {
      addLog("Backtest error: " + (e as Error).message, "error");
    } finally {
      setTesting(false);
    }
  }

  // ── Deploy live + on-chain ledger ────────────────────────────────────────────
  const { data: ledgerData, mutate: mutateLedger } = useSWR<{ ok: boolean; calls: LedgerCall[]; record?: LedgerRecord }>(
    "/api/agent/ledger", fetcher, { refreshInterval: 20_000 },
  );
  const ledger = ledgerData?.calls ?? [];
  const record = ledgerData?.record;
  const [deploying, setDeploying] = useState(false);

  async function deploy() {
    if (!spec || deploying) return;
    setDeploying(true);
    addLog(`Deploying "${spec.name}" — scanning live markets for entry signals…`, "exec");
    try {
      const r = await fetch("/api/agent/deploy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const j = await r.json();
      if (!j.ok) { addLog("Deploy failed: " + j.error, "error"); return; }
      if (j.inscribed === 0) {
        addLog(`Agent armed — no entry signal across ${j.scanned} live markets right now.`, "warn");
      } else {
        addLog(`✓ Agent fired on ${j.fired} market${j.fired !== 1 ? "s" : ""} · ${j.inscribed} call${j.inscribed !== 1 ? "s" : ""} inscribed on Solana.`, "success");
        (j.calls as LedgerCall[]).forEach((c) =>
          addLog(`◉ ${c.match} — ${c.side.toUpperCase()} ${c.selection} @ ${c.odds} · tx ${c.signature.slice(0, 12)}…`, "success"));
        mutateLedger();
      }
    } catch (e) {
      addLog("Deploy error: " + (e as Error).message, "error");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="flex h-screen w-full flex-col bg-[#050505] text-gray-300 font-mono overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-black px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-500/20 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Zap className="size-4" />
          </div>
          <h1 className="text-sm font-bold tracking-widest text-white">
            TxAGENT <span className="text-gray-600">|</span> DESK
          </h1>
          <span className="hidden sm:inline rounded bg-white/5 px-2 py-0.5 text-[10px] text-gray-500">
            describe your edge · deploy a verifiable agent
          </span>
        </div>
        <span className="flex items-center gap-2 text-xs text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          TXLINE CONNECTED
        </span>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left: compose + backtest */}
        <section className="flex w-2/3 flex-col overflow-y-auto border-r border-white/10 bg-[#0a0a0a]">
          {/* Compose */}
          <Panel icon={<Sparkles className="size-3" />} title="COMPOSE STRATEGY">
            <div className="p-5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) compile(); }}
                placeholder="e.g. Back the underdog when their odds shorten more than 8% before kickoff…"
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-black p-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-emerald-500/50"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex, i) => (
                  <button key={i} onClick={() => setText(ex)}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-gray-500 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors">
                    {ex.split(" ").slice(0, 4).join(" ")}…
                  </button>
                ))}
              </div>
              <button onClick={compile} disabled={compiling || !text.trim()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-xs font-bold text-black hover:bg-gray-200 disabled:opacity-40 transition-colors">
                {compiling ? <><Loader2 className="size-4 animate-spin" /> COMPILING…</> : <><Cpu className="size-4" /> COMPILE WITH ACE</>}
              </button>

              {spec && <SpecCard spec={spec} />}
            </div>
          </Panel>

          {/* Backtest */}
          <Panel icon={<Activity className="size-3" />} title="PROVABLY-FAIR BACKTEST">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <ShieldCheck className="size-3 text-emerald-500" />
                  Replayed on real TxLINE data · Merkle-verifiable via <span className="text-emerald-400">validate_stat</span>
                </p>
                <button onClick={runBacktest} disabled={!spec || testing}
                  className="flex items-center gap-2 rounded bg-emerald-500/15 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-30 transition-colors">
                  {testing ? <><Loader2 className="size-3.5 animate-spin" /> RUNNING</> : <><Play className="size-3.5" /> RUN BACKTEST</>}
                </button>
              </div>

              {!backtest && !testing && (
                <div className="mt-6 flex h-40 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-gray-600">
                  {spec ? "Run the backtest to see the equity curve." : "Compile a strategy first."}
                </div>
              )}

              {backtest && <BacktestView bt={backtest} />}
            </div>
          </Panel>

          {/* Deploy live + on-chain ledger */}
          <Panel icon={<Radio className="size-3" />} title="ON-CHAIN AGENT LEDGER" grow>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <ShieldCheck className="size-3 text-emerald-500" />
                  Every call ORA makes is inscribed on <span className="text-emerald-400">Solana</span> — public, timestamped, tamper-proof.
                </p>
                <button onClick={deploy} disabled={!spec || deploying}
                  className="flex shrink-0 items-center gap-2 rounded bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-30 transition-colors">
                  {deploying ? <><Loader2 className="size-3.5 animate-spin" /> DEPLOYING</> : <><Send className="size-3.5" /> DEPLOY AGENT LIVE</>}
                </button>
              </div>

              {record && (record.won + record.lost > 0) && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/10 bg-black px-3 py-2 font-mono text-[11px]">
                  <span className="text-gray-500">ORA&apos;s on-chain record:</span>
                  <span className="font-bold text-emerald-400">{record.won}W</span>
                  <span className="text-gray-600">·</span>
                  <span className="font-bold text-red-400">{record.lost}L</span>
                  {record.pending > 0 && <><span className="text-gray-600">·</span><span className="text-gray-500">{record.pending} pending</span></>}
                  <span className="ml-auto text-emerald-500">
                    {Math.round((record.won / (record.won + record.lost)) * 100)}% hit rate
                  </span>
                </div>
              )}

              {ledger.length === 0 ? (
                <div className="mt-4 flex h-32 items-center justify-center rounded-lg border border-dashed border-white/10 px-4 text-center text-xs text-gray-600">
                  {spec ? "Deploy your agent to make its first verifiable on-chain call." : "Compile a strategy, then deploy it live."}
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {ledger.map((c) => <LedgerCard key={c.signature} c={c} />)}
                </div>
              )}
            </div>
          </Panel>
        </section>

        {/* Right: live markets + terminal */}
        <section className="flex w-1/3 flex-col bg-black">
          <Panel icon={<TrendingUp className="size-3" />} title="TRADEABLE MARKETS · LIVE + UPCOMING">
            <div className="max-h-60 overflow-y-auto p-3 space-y-1.5">
              {markets.length === 0 && !marketsError && <p className="p-3 text-[11px] text-gray-600">Loading fixtures…</p>}
              {marketsError && markets.length === 0 && (
                <p className="p-3 text-[11px] text-yellow-500/80">Markets unavailable — TxLINE token may need refreshing.</p>
              )}
              {!marketsError && markets.length === 0 && fxData && (
                <p className="p-3 text-[11px] text-gray-600">No live or upcoming games in range.</p>
              )}
              {markets.map((m) => (
                <div key={m.FixtureId} className="flex items-center justify-between gap-2 rounded border border-white/5 bg-[#0d0d0d] px-3 py-2 text-xs">
                  <span className="truncate text-gray-300">{m.Participant1} <span className="text-gray-600">v</span> {m.Participant2}</span>
                  {m.phase === "live"
                    ? <span className="flex shrink-0 items-center gap-1 text-[10px] text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE</span>
                    : <span className="shrink-0 text-[10px] text-gray-500">{kickoff(m.StartTime)}</span>}
                </div>
              ))}
            </div>
          </Panel>

          <div className="flex flex-1 flex-col border-t border-white/10">
            <div className="flex items-center gap-2 border-b border-white/5 bg-[#0d0d0d] px-4 py-2 text-xs tracking-widest text-gray-400">
              <SquareTerminal className="size-3" /> AGENT TERMINAL
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-[11px] leading-relaxed">
              {logs.map((l, i) => (
                <div key={i} className="mb-2 flex items-start gap-2">
                  <span className="shrink-0 text-gray-700">[{l.time}]</span>
                  <span className={cn("break-words",
                    l.type === "info" && "text-gray-400",
                    l.type === "warn" && "text-yellow-400",
                    l.type === "exec" && "text-blue-400",
                    l.type === "success" && "text-emerald-400",
                    l.type === "error" && "text-red-400")}>
                    {(l.type === "exec" || l.type === "success") ? "> " : ""}{l.msg}
                  </span>
                </div>
              ))}
              <div ref={logEnd} />
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 p-3 text-xs text-gray-600">
              <ArrowRight className="size-3" /><span className="animate-pulse">_</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────────

type CallStatus = "won" | "lost" | "pending";
type LedgerRecord = { won: number; lost: number; pending: number };
type LedgerCall = {
  strategy: string;
  match: string;
  side: "back" | "lay";
  selection: "home" | "draw" | "away";
  odds: number;
  reasoning: string;
  status: CallStatus;
  finalScore: string | null;
  timestamp: number;
  signature: string;
  explorerUrl: string;
};

function StatusChip({ status, score }: { status: CallStatus; score: string | null }) {
  if (status === "won")
    return <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">✓ WON{score ? ` ${score}` : ""}</span>;
  if (status === "lost")
    return <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400">✗ LOST{score ? ` ${score}` : ""}</span>;
  return <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">◷ PENDING</span>;
}

function LedgerCard({ c }: { c: LedgerCall }) {
  const won = c.status === "won";
  const lost = c.status === "lost";
  return (
    <div className={cn("rounded-lg border p-3",
      won ? "border-emerald-500/30 bg-emerald-500/[0.04]" : lost ? "border-red-500/30 bg-red-500/[0.04]" : "border-white/10 bg-[#0d0d0d]")}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold text-white">{c.match}</span>
        <StatusChip status={c.status} score={c.finalScore} />
      </div>
      <p className="mt-1 text-[11px] font-medium text-emerald-400">
        {sideVerb(c.side)} {selectionShort(c.selection)} · pays {oddsLabel(c.odds)}
      </p>
      <p className="mt-1 text-[11px] italic leading-relaxed text-gray-400">“{c.reasoning}”</p>
      <div className="mt-2 flex items-center justify-between text-[9px]">
        <span className="flex items-center gap-1 text-gray-500">
          <ShieldCheck className="size-2.5 text-emerald-500" /> {c.strategy}
        </span>
        <a href={c.explorerUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-gray-500 transition-colors hover:text-emerald-400">
          Solana {c.signature.slice(0, 6)}… <ExternalLink className="size-2.5" />
        </a>
      </div>
    </div>
  );
}

function Panel({ icon, title, grow, children }: { icon: React.ReactNode; title: string; grow?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col", grow && "flex-1")}>
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#0d0d0d] px-4 py-2 text-xs tracking-widest text-gray-400">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function SpecCard({ spec }: { spec: StrategySpec }) {
  return (
    <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-white">{spec.name}</span>
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">Compiled</span>
      </div>
      <div className="space-y-2">
        <RuleRow k="WHEN" accent v={conditionText(spec)} />
        <RuleRow k="THEN" v={`${actionText(spec)} — ${spec.stake} USDC per bet`} />
      </div>
      <p className="mt-3 text-[10px] text-gray-500">
        Market: <span className="text-gray-300">Match winner (full-time result)</span>
      </p>
      <p className="mt-1 text-[11px] italic leading-relaxed text-gray-400">“{spec.summary}”</p>
    </div>
  );
}

function RuleRow({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded border border-white/5 bg-black px-3 py-2">
      <span className={cn("shrink-0 pt-0.5 text-[10px] font-bold tracking-wider", accent ? "text-emerald-500" : "text-blue-400")}>{k}</span>
      <span className="text-xs leading-relaxed text-white">{v}</span>
    </div>
  );
}

function BacktestView({ bt }: { bt: BacktestSummary & { matchesScanned: number } }) {
  const pos = bt.pnl >= 0;
  const color = pos ? "#10b981" : "#f43f5e";
  return (
    <div className="mt-4">
      <div className="grid grid-cols-4 gap-2">
        <Stat label="WIN RATE" value={`${(bt.winRate * 100).toFixed(0)}%`} sub={`${bt.wins} of ${bt.count} won`} />
        <Stat label="NET PROFIT" value={`${pos ? "+" : ""}${bt.pnl}`} sub="USDC" accent={pos ? "up" : "down"} />
        <Stat label="RETURN" value={`${(bt.roi * 100).toFixed(1)}%`} sub="per bet staked" accent={bt.roi >= 0 ? "up" : "down"} />
        <Stat label="BETS PLACED" value={`${bt.count}`} sub={`of ${bt.matchesScanned} matches`} />
      </div>

      {/* Equity curve */}
      <div className="mt-4 h-40 w-full rounded-lg border border-white/10 bg-black p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={bt.equity}>
            <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
            <XAxis dataKey="i" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ backgroundColor: "#000", borderColor: "#333", fontSize: 11, fontFamily: "monospace" }}
              labelFormatter={(l) => `after bet ${l}`} formatter={(v) => [`${v} USDC`, "Running profit"]} />
            <Line type="monotone" dataKey="pnl" stroke={color} strokeWidth={2} dot={false} isAnimationActive />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trades */}
      <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-white/10">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0d0d0d] text-gray-500">
            <tr><th className="p-2 text-left font-normal">MATCH</th><th className="p-2 text-left font-normal">BET</th><th className="p-2 text-right font-normal">PROFIT</th></tr>
          </thead>
          <tbody>
            {bt.trades.map((t) => (
              <tr key={t.fixtureId} className="border-t border-white/5">
                <td className="max-w-[180px] truncate p-2 text-gray-300">{t.match}</td>
                <td className="p-2 text-gray-500">{sideVerb(t.side)} {selectionShort(t.selection)} · pays {oddsLabel(t.entryDec)}</td>
                <td className={cn("p-2 text-right font-bold tabular-nums", t.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {t.pnl > 0 ? "+" : ""}{t.pnl}
                </td>
              </tr>
            ))}
            {bt.trades.length === 0 && (
              <tr><td colSpan={3} className="p-4 text-center text-gray-600">No matches matched your rule in range.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "up" | "down" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black p-3">
      <p className="text-[9px] uppercase tracking-wider text-gray-600">{label}</p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums flex items-center gap-1",
        accent === "up" ? "text-emerald-400" : accent === "down" ? "text-red-400" : "text-white")}>
        {accent === "up" && <TrendingUp className="size-3.5" />}
        {accent === "down" && <TrendingDown className="size-3.5" />}
        {value}
      </p>
      {sub && <p className="text-[9px] text-gray-600">{sub}</p>}
    </div>
  );
}
