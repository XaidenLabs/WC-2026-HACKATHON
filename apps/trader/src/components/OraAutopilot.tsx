"use client";

import { useEffect, useRef, useState } from "react";
import { Power, Loader2, ExternalLink, Radio } from "lucide-react";
import { cn } from "@/lib/ui";

type Cycle = {
  ok: boolean; scanned: number; priced: number; valueFound: number; inscribed: number;
  calls: { match: string; selection: string; odds: number; evPct: number; signature: string; explorerUrl: string }[];
  passed: { match: string; reason: string; receipt?: string; explorerUrl?: string }[];
  mandate?: { minEvPct: number; maxCallsPerCycle: number; maxCallsPerDay: number; fixedReferenceStake: number };
  error?: string;
};
type Log = { time: string; msg: string; tone: "info" | "fire" | "pass" | "err"; url?: string };

const INTERVAL_MS = 45_000;

/**
 * ORA Autopilot. Once armed, ORA runs its value model over live TxLINE markets on a loop and
 * inscribes value calls on Solana with no human input. In production the same endpoint runs on a
 * Vercel cron (see vercel.json); this panel makes the autonomy visible during a demo.
 */
export default function OraAutopilot({ onCycle }: { onCycle?: () => void }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const add = (msg: string, tone: Log["tone"], url?: string) =>
    setLogs((p) => [{ time: new Date().toLocaleTimeString(), msg, tone, url }, ...p].slice(0, 40));

  async function runCycle() {
    setBusy(true);
    try {
      const r = await fetch("/api/agent/autopilot", { headers: { "x-autopilot-ui": "1" }, cache: "no-store" });
      const j = (await r.json()) as Cycle;
      if (!j.ok) { add(`Cycle error: ${j.error ?? r.status}`, "err"); return; }
      add(`Scanned ${j.scanned} markets · priced ${j.priced} · ${j.valueFound} with value`, "info");
      if (j.inscribed === 0) add("No new value opportunities. ORA stood aside this cycle.", "pass");
      for (const p of j.passed ?? []) add(`PASS · ${p.match}: ${p.reason}`, "pass", p.explorerUrl);
      for (const c of j.calls) {
        add(`◉ Backed ${c.selection} in ${c.match} @ ${c.odds} · EV ${c.evPct >= 0 ? "+" : ""}${c.evPct}% · inscribed on Solana`, "fire", c.explorerUrl);
      }
      onCycle?.();
    } catch (e) {
      add(`Network error: ${(e as Error).message}`, "err");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!armed) { if (timer.current) clearInterval(timer.current); timer.current = null; return; }
    const initial = setTimeout(() => { void runCycle(); }, 0);
    timer.current = setInterval(runCycle, INTERVAL_MS);
    return () => { clearTimeout(initial); if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed]);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <span className="flex items-center gap-2 text-xs tracking-widest text-gray-400">
          <Radio className="size-3" /> ORA AUTOPILOT
        </span>
        <span className={cn("flex items-center gap-1.5 font-mono text-[10px]", armed ? "text-emerald-400" : "text-gray-500")}>
          <span className={cn("size-1.5 rounded-full", armed ? "bg-emerald-500 animate-pulse" : "bg-gray-600")} />
          {armed ? `armed · every ${INTERVAL_MS / 1000}s` : "idle"}
        </span>
      </div>

      <div className="p-4">
        <p className="text-[11px] leading-relaxed text-gray-500">
          ORA acts only at ≥4% expected value, with one call per cycle and three calls per day. Every
          trade and every pass receives a Solana receipt, so restraint is auditable too.
        </p>
        <button
          onClick={() => setArmed((v) => {
            if (!v) add("Autopilot armed. ORA is now trading its value model on its own.", "info");
            return !v;
          })}
          className={cn("mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-colors",
            armed ? "bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25"
              : "bg-emerald-500 text-black hover:bg-emerald-400")}>
          {busy && armed ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
          {armed ? "DISARM AUTOPILOT" : "ARM AUTOPILOT"}
        </button>

        <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto font-mono text-[11px]">
          {logs.length === 0 && <p className="text-gray-600">Autopilot idle. Arm it to watch ORA trade itself.</p>}
          {logs.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="shrink-0 text-gray-700">[{l.time}]</span>
              <span className={cn("break-words",
                l.tone === "fire" && "text-emerald-400",
                l.tone === "pass" && "text-gray-500",
                l.tone === "err" && "text-red-400",
                l.tone === "info" && "text-gray-400")}>
                {l.msg}
                {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-gray-500 hover:text-emerald-400">tx <ExternalLink className="size-2.5" /></a>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
