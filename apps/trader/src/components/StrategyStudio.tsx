"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles, Activity, Play, ShieldCheck, Loader2, Cpu, Send, Radio, SquareTerminal, ArrowRight, Lock,
} from "lucide-react";
import { LineChart, Line, YAxis, XAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { cn } from "@/lib/ui";
import { Stat } from "@/components/AgentLedger";
import { useTraderWallet } from "@/hooks/useTraderWallet";
import type { BacktestSummary, StrategySpec } from "@/lib/agent/strategy";
import { actionText, conditionText, oddsLabel, selectionShort, sideVerb } from "@/lib/agent/humanize";

type LogType = "info" | "warn" | "exec" | "success" | "error";
type Log = { time: string; msg: string; type: LogType };

const EXAMPLES = [
  "Back the underdog to win when their odds shorten more than 8% before kickoff · the market is telling me something.",
  "Lay the favourite whenever they're priced above 65%. Fade the public.",
  "Back the home team whenever they're a live underdog below 35% implied.",
];

/**
 * The full ORA agent workflow: describe a strategy → compile (ACE) → backtest on real WC data →
 * deploy ORA live. Pass `fixtureId`+`matchLabel` to scope the deploy to a single match.
 * `onDeployed` lets the parent refresh its ledger immediately.
 */
export default function StrategyStudio({
  fixtureId, matchLabel, onDeployed,
}: { fixtureId?: number; matchLabel?: string; onDeployed?: () => void }) {
  const scoped = fixtureId != null;
  const { authenticated, login } = useTraderWallet();

  // Terminal
  const [logs, setLogs] = useState<Log[]>([
    { time: "--:--:--", msg: "TxAgent runtime online.", type: "info" },
    { time: "--:--:--", msg: "Connecting to TxLINE decentralized feed…", type: "info" },
  ]);
  const termRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const addLog = (msg: string, type: LogType = "info") =>
    setLogs((p) => [...p, { time: new Date().toLocaleTimeString(), msg, type }]);
  useEffect(() => {
    const el = termRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [logs]);

  // Compose + compile
  const [text, setText] = useState("");
  const [spec, setSpec] = useState<StrategySpec | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [backtest, setBacktest] = useState<(BacktestSummary & { matchesScanned: number }) | null>(null);
  const [testing, setTesting] = useState(false);
  const [deploying, setDeploying] = useState(false);

  async function compile() {
    if (!authenticated) { login(); return; }
    if (!text.trim() || compiling) return;
    setCompiling(true); setSpec(null); setBacktest(null);
    addLog("Compiling natural-language strategy via ACE (gpt-4o-mini)…", "exec");
    try {
      const r = await fetch("/api/agent/compile", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      const j = await r.json();
      if (!j.ok) { addLog("Compile failed: " + j.error, "error"); return; }
      setSpec(j.spec);
      addLog(`✓ Compiled "${j.spec.name}" · ${j.source === "ace" ? "ACE" : "heuristic"}. Ready to backtest.`, "success");
    } catch (e) {
      addLog("Compile error: " + (e as Error).message, "error");
    } finally { setCompiling(false); }
  }

  async function runBacktest() {
    if (!authenticated) { login(); return; }
    if (!spec || testing) return;
    setTesting(true);
    addLog("Replaying strategy over real World Cup match data (Merkle-verified)…", "exec");
    try {
      const r = await fetch("/api/agent/backtest", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec }),
      });
      const j = await r.json();
      if (!j.ok) { addLog("Backtest failed: " + j.error, "error"); return; }
      setBacktest({ ...j.summary, matchesScanned: j.matchesScanned });
      const s = j.summary;
      addLog(`✓ Backtest complete · ${s.count} bets across ${j.matchesScanned} matches · ${(s.winRate * 100).toFixed(0)}% won · profit ${s.pnl > 0 ? "+" : ""}${s.pnl} USDC`,
        s.pnl >= 0 ? "success" : "warn");
    } catch (e) {
      addLog("Backtest error: " + (e as Error).message, "error");
    } finally { setTesting(false); }
  }

  async function deploy() {
    if (!authenticated) { login(); return; }
    if (!spec || deploying) return;
    setDeploying(true);
    addLog(scoped ? `Deploying "${spec.name}" on ${matchLabel ?? "this match"}…` : `Deploying "${spec.name}" · scanning live markets…`, "exec");
    try {
      const r = await fetch("/api/agent/deploy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, fixtureId }),
      });
      const j = await r.json();
      if (!j.ok) { addLog("Deploy failed: " + j.error, "error"); return; }
      if (j.inscribed === 0) {
        addLog(scoped ? "No tradeable price on this match right now · agent is armed and watching." : "No open markets to price right now · agent is armed and watching.", "warn");
      } else {
        addLog(
          j.bestFit
            ? `✓ No strict signal · agent took its ${j.inscribed} best-fit position${j.inscribed !== 1 ? "s" : ""}, inscribed on Solana.`
            : `✓ Agent fired on ${j.fired} signal${j.fired !== 1 ? "s" : ""} · ${j.inscribed} call${j.inscribed !== 1 ? "s" : ""} inscribed on Solana.`,
          "success",
        );
        (j.calls as { match: string; side: string; selection: string; odds: number; signature: string }[]).forEach((c) =>
          addLog(`◉ ${c.match} · ${c.side.toUpperCase()} ${c.selection} @ ${c.odds} · tx ${c.signature.slice(0, 12)}…`, "success"));
        onDeployed?.();
      }
    } catch (e) {
      addLog("Deploy error: " + (e as Error).message, "error");
    } finally { setDeploying(false); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      {/* Left: compose + backtest + deploy */}
      <div className="space-y-4">
        <Panel icon={<Sparkles className="size-3" />} title="COMPOSE STRATEGY">
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
                className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-gray-500 transition-colors hover:border-emerald-500/40 hover:text-emerald-400">
                {ex.split(" ").slice(0, 4).join(" ")}…
              </button>
            ))}
          </div>
          <button onClick={compile} disabled={authenticated ? (compiling || !text.trim()) : false}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-xs font-bold text-black transition-colors hover:bg-gray-200 disabled:opacity-40">
            {!authenticated ? <><Lock className="size-4" /> SIGN IN TO COMPILE</>
              : compiling ? <><Loader2 className="size-4 animate-spin" /> COMPILING…</>
              : <><Cpu className="size-4" /> COMPILE WITH ACE</>}
          </button>
          {!authenticated && (
            <p className="mt-2 text-center text-[10px] text-gray-600">Sign in to compile, backtest, and deploy strategies.</p>
          )}
          {spec && <SpecCard spec={spec} />}
        </Panel>

        <Panel icon={<Activity className="size-3" />} title="PROVABLY-FAIR BACKTEST">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <ShieldCheck className="size-3 text-emerald-500" />
              Replayed on real TxLINE data · Merkle-verifiable via <span className="text-emerald-400">validate_stat</span>
            </p>
            <button onClick={runBacktest} disabled={!spec || testing}
              className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-30">
              {testing ? <><Loader2 className="size-3.5 animate-spin" /> RUNNING</> : <><Play className="size-3.5" /> RUN BACKTEST</>}
            </button>
          </div>
          {!backtest && !testing && (
            <div className="mt-4 flex h-32 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-gray-600">
              {spec ? "Run the backtest to see the equity curve." : "Compile a strategy first."}
            </div>
          )}
          {backtest && <BacktestView bt={backtest} />}
        </Panel>

        <Panel icon={<Radio className="size-3" />} title={scoped ? "DEPLOY ORA ON THIS MATCH" : "DEPLOY ORA LIVE"}>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <ShieldCheck className="size-3 text-emerald-500" />
              Every call is inscribed on <span className="text-emerald-400">Solana</span> · public, timestamped, tamper-proof.
            </p>
            <button onClick={deploy} disabled={!spec || deploying}
              className="flex shrink-0 items-center gap-2 rounded bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-emerald-400 disabled:opacity-30">
              {deploying ? <><Loader2 className="size-3.5 animate-spin" /> DEPLOYING</> : <><Send className="size-3.5" /> {scoped ? "DEPLOY HERE" : "DEPLOY LIVE"}</>}
            </button>
          </div>
          {!spec && <p className="mt-3 text-[10px] text-gray-600">Compile a strategy, then deploy ORA to make its first verifiable call{scoped ? " on this match" : ""}.</p>}

          {/* Safety warning */}
          {spec && !deploying && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.04] p-2.5">
              <Lock className="size-3 shrink-0 mt-0.5 text-yellow-500" />
              <p className="text-[10px] leading-relaxed text-yellow-200/80">
                Once deployed, this agent operates autonomously within the compiled parameters above.
                No manual intervention or parameter changes are possible after deployment.
              </p>
            </div>
          )}

          {/* Strategy Frozen indicator (after deploy success) */}
          {spec && !deploying && logs.some(l => l.type === "success" && l.msg.includes("inscribed on Solana")) && (
            <div className="mt-2 flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <Lock className="size-3 text-emerald-400" />
              <div>
                <p className="text-[10px] font-bold text-emerald-400">STRATEGY FROZEN</p>
                <p className="text-[9px] text-gray-500">Spec is immutable — deployed with the exact parameters shown in the audit above.</p>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Right: terminal */}
      <div className="flex min-h-[380px] flex-col overflow-hidden rounded-lg border border-white/10 bg-black lg:sticky lg:top-4 lg:min-h-[620px] lg:self-start">
        <div className="flex items-center gap-2 border-b border-white/5 bg-[#0d0d0d] px-4 py-2 text-xs tracking-widest text-gray-400">
          <SquareTerminal className="size-3" /> AGENT TERMINAL
        </div>
        <div ref={termRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
          className="min-h-0 flex-1 overflow-y-auto p-4 text-[11px] leading-relaxed">
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
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 p-3 text-xs text-gray-600">
          <ArrowRight className="size-3" /><span className="animate-pulse">_</span>
        </div>
      </div>
    </div>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0a]">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 text-xs tracking-widest text-gray-400">
        {icon} {title}
      </div>
      <div className="p-4">{children}</div>
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
        <RuleRow k="THEN" v={`${actionText(spec)} · ${spec.stake} USDC per bet`} />
      </div>
      <p className="mt-3 text-[10px] text-gray-500">Market: <span className="text-gray-300">Match winner (full-time result)</span></p>
      <p className="mt-1 text-[11px] italic leading-relaxed text-gray-400">“{spec.summary}”</p>

      {/* ── Compiled Spec Audit ── */}
      <div className="mt-4 rounded-lg border border-white/10 bg-black p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <ShieldCheck className="size-3 text-emerald-500" /> Compiled Spec Audit
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
            <Lock className="size-2.5" /> Deterministic
          </span>
        </div>

        {/* Structured rule as pseudo-code */}
        <div className="rounded border border-white/5 bg-[#0d0d0d] p-2.5 font-mono text-[10px] leading-relaxed text-gray-300">
          <span className="text-emerald-500">IF</span> {triggerAuditText(spec)} <span className="text-blue-400">→</span>{" "}
          <span className="text-emerald-500">{spec.side.toUpperCase()}</span> {selectionShort(spec.selection)} @{" "}
          <span className="text-white">{spec.stake} USDC</span>
        </div>

        {/* Parameter bounds */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-white/5 bg-[#0d0d0d] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wider text-gray-600">Trigger Type</p>
            <p className="mt-0.5 text-xs font-bold text-white">{spec.trigger.type.replace("_", " ")}</p>
          </div>
          <div className="rounded border border-white/5 bg-[#0d0d0d] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wider text-gray-600">Trigger Value</p>
            <p className="mt-0.5 text-xs font-bold text-white">{spec.trigger.type === "always" ? "N/A" : `${spec.trigger.value}%`}</p>
          </div>
          <div className="rounded border border-white/5 bg-[#0d0d0d] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wider text-gray-600">Stake per bet</p>
            <p className="mt-0.5 text-xs font-bold text-white">{spec.stake} USDC (fixed)</p>
          </div>
          <div className="rounded border border-white/5 bg-[#0d0d0d] px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wider text-gray-600">Market</p>
            <p className="mt-0.5 text-xs font-bold text-white">{spec.market} (match winner)</p>
          </div>
        </div>

        <p className="text-[9px] text-gray-600 leading-relaxed">
          This strategy is deterministic — same data in, same decision out. No randomness, no manual override, no parameter drift after deployment.
        </p>
      </div>
    </div>
  );
}

/** Builds a human-readable audit line for the trigger condition. */
function triggerAuditText(spec: StrategySpec): string {
  const t = spec.trigger;
  const sel = selectionShort(spec.selection);
  switch (t.type) {
    case "always": return `match.kickoff == true`;
    case "prob_below": return `${sel}.implied_prob < ${t.value}%`;
    case "prob_above": return `${sel}.implied_prob > ${t.value}%`;
    case "odds_drop": return `${sel}.prob_change >= +${t.value}pp in ${t.windowMin ?? "?"} min`;
    case "odds_rise": return `${sel}.prob_change <= -${t.value}pp in ${t.windowMin ?? "?"} min`;
    default: return "·";
  }
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

  // ── Risk metrics ───────────────────────────────────────────────────
  const equityVals = bt.equity.map((e) => e.pnl);
  let maxDrawdown = 0;
  let peak = 0;
  for (const v of equityVals) {
    if (v > peak) peak = v;
    const dd = peak - v;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }
  maxDrawdown = Math.round(maxDrawdown * 100) / 100;
  const largestLoss = bt.trades.length
    ? Math.round(Math.min(...bt.trades.map((t) => t.pnl)) * 100) / 100
    : 0;
  // Simplified Sharpe: mean(pnl) / std(pnl) — annualization not relevant for a tournament
  const mean = bt.trades.length ? bt.pnl / bt.trades.length : 0;
  const variance = bt.trades.length
    ? bt.trades.reduce((s, t) => s + (t.pnl - mean) ** 2, 0) / bt.trades.length
    : 0;
  const sharpe = variance > 0 ? Math.round((mean / Math.sqrt(variance)) * 100) / 100 : 0;

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="WIN RATE" value={`${(bt.winRate * 100).toFixed(0)}%`} sub={`${bt.wins} of ${bt.count} won`} />
        <Stat label="NET PROFIT" value={`${pos ? "+" : ""}${bt.pnl}`} sub="USDC" accent={pos ? "up" : "down"} />
        <Stat label="RETURN" value={`${(bt.roi * 100).toFixed(1)}%`} sub="per bet staked" accent={bt.roi >= 0 ? "up" : "down"} />
        <Stat label="BETS PLACED" value={`${bt.count}`} sub={`of ${bt.matchesScanned} matches`} />
      </div>

      {/* ── Risk Summary ── */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/10 bg-black p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-gray-600">Max Drawdown</p>
          <p className={cn("mt-0.5 text-sm font-bold tabular-nums", maxDrawdown > 0 ? "text-red-400" : "text-gray-400")}>
            {maxDrawdown > 0 ? "-" : ""}{maxDrawdown} <span className="text-[9px] font-normal text-gray-600">USDC</span>
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-gray-600">Sharpe Ratio</p>
          <p className={cn("mt-0.5 text-sm font-bold tabular-nums", sharpe >= 0.5 ? "text-emerald-400" : sharpe >= 0 ? "text-gray-300" : "text-red-400")}>
            {sharpe.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-gray-600">Largest Loss</p>
          <p className={cn("mt-0.5 text-sm font-bold tabular-nums", largestLoss < 0 ? "text-red-400" : "text-gray-400")}>
            {largestLoss < 0 ? "" : "+"}{largestLoss} <span className="text-[9px] font-normal text-gray-600">USDC</span>
          </p>
        </div>
      </div>

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
