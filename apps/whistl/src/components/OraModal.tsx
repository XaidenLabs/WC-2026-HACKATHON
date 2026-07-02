"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type EventKind =
  | "init" | "heartbeat" | "goal" | "goal_cancelled" | "corner"
  | "yellow_card" | "red_card" | "var" | "card" | "observation"
  | "prediction" | "early_settle" | "settle_start" | "settle_proof"
  | "settle_done" | "settle_error" | "finished";

type KeeperEvent = { id: number; ts: number; kind: EventKind; message: string };
type WatcherStatus = "watching" | "settling" | "done" | "error";

export type OraModalProps = {
  fixtureId: number;
  p1: string;
  p2: string;
  onClose: () => void;
};

function terminalColor(kind: EventKind): string {
  switch (kind) {
    case "goal":         return "text-amber-400 font-bold";
    case "goal_cancelled": return "text-red-400 font-semibold";
    case "var":          return "text-red-300";
    case "yellow_card":  return "text-yellow-400";
    case "red_card":     return "text-red-500 font-semibold";
    case "corner":       return "text-cyan-600";
    case "settle_done":  return "text-emerald-400 font-semibold";
    case "settle_error": return "text-red-500";
    case "early_settle": return "text-amber-500";
    case "finished":     return "text-emerald-300 font-semibold";
    case "heartbeat":    return "text-green-700";
    case "observation":  return "text-green-600";
    case "init":         return "text-green-500";
    default:             return "text-green-600";
  }
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function OraModal({ fixtureId, p1, p2, onClose }: OraModalProps) {
  const [events, setEvents]   = useState<KeeperEvent[]>([]);
  const [status, setStatus]   = useState<WatcherStatus>("watching");
  const [score,  setScore]    = useState<{ p1: number; p2: number; minutes: number } | null>(null);
  const [phase,  setPhase]    = useState<"starting" | "running" | "error">("starting");
  const [errMsg, setErrMsg]   = useState("");
  const lastId  = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/ora/keeper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId, p1, p2, pacts: [], speed: 3 }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok && j.error) {
          setErrMsg(
            j.error === "NO_SCORE_DATA"
              ? "No score data available — check back once the match kicks off."
              : j.error,
          );
          setPhase("error");
          return;
        }
        if (j.status) setStatus(j.status as WatcherStatus);
        setPhase("running");
      })
      .catch((e) => { setErrMsg((e as Error).message); setPhase("error"); });
  }, [fixtureId, p1, p2]);

  useEffect(() => {
    if (phase !== "running") return;
    let gone = false;
    async function poll() {
      if (gone) return;
      try {
        const r = await fetch(`/api/ora/events/${fixtureId}?since=${lastId.current}`);
        if (!r.ok || gone) return;
        const j = await r.json();
        if (gone) return;
        if (j.events?.length) { setEvents((p) => [...p, ...j.events]); lastId.current = j.lastId; }
        if (j.status)       setStatus(j.status);
        if (j.currentScore) setScore(j.currentScore);
      } catch { /* ignore */ }
    }
    poll();
    const id = setInterval(poll, 1500);
    return () => { gone = true; clearInterval(id); };
  }, [fixtureId, phase]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [events]);

  const isLive    = status === "watching";
  const isSettling = status === "settling";
  const isDone    = status === "done";

  const statusLabel = isLive ? "● LIVE" : isSettling ? "○ SETTLING" : isDone ? "■ DONE" : "! ERROR";
  const statusCls   = isLive ? "text-green-400" : isSettling ? "text-amber-400" : isDone ? "text-green-700" : "text-red-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Terminal window */}
      <div className="w-full max-w-2xl flex flex-col h-[92vh] sm:h-[88vh] bg-black border border-green-900/40 font-mono shadow-2xl shadow-black">

        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-b border-green-900/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-600/80" />
            <span className="size-2.5 rounded-full bg-yellow-500/80" />
            <span className="size-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="text-[11px] text-green-700 tracking-[0.2em] uppercase">
            ORA SENTINEL — {p1} vs {p2}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-green-900 hover:text-green-400 transition-colors p-0.5"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#050f05] border-b border-green-900/30 shrink-0 text-[11px]">
          <span className="text-green-600">
            {score
              ? `${p1}  ${score.p1} — ${score.p2}  ${p2}    ${score.minutes}'`
              : `${p1} vs ${p2}`}
          </span>
          <span className={`tracking-widest ${statusCls} ${isLive ? "animate-pulse" : ""}`}>
            {statusLabel}
          </span>
        </div>

        {/* Terminal output */}
        <div
          ref={feedRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {phase === "starting" && (
            <div className="text-green-800 text-xs mt-2">
              <span className="animate-pulse">█</span> Connecting to TxLINE…
            </div>
          )}
          {phase === "error" && (
            <div className="text-red-500 text-xs mt-2">
              ! ERROR — {errMsg}
            </div>
          )}
          {phase === "running" && events.length === 0 && (
            <div className="text-green-800 text-xs mt-2">
              <span className="animate-pulse">█</span> Loading match events…
            </div>
          )}

          {events.map((ev) => (
            <div key={ev.id} className={`flex gap-2 text-xs leading-relaxed ${terminalColor(ev.kind)}`}>
              <span className="text-green-900 shrink-0 tabular-nums select-none">
                {fmtTime(ev.ts)}
              </span>
              <span className="text-green-900 shrink-0 select-none">›</span>
              <span className="min-w-0 break-words whitespace-pre-wrap">{ev.message}</span>
            </div>
          ))}

          {/* Blinking cursor when watching */}
          {phase === "running" && isLive && (
            <div className="flex gap-2 text-xs text-green-900 mt-0.5">
              <span className="select-none tabular-nums">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span className="select-none">›</span>
              <span className="text-green-700 animate-pulse">▊</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-green-900/30 px-4 py-1.5 text-[10px] text-green-900 flex items-center justify-between bg-[#050f05]">
          <span>TxLINE · Merkle proof settlement · validate_stat on-chain</span>
          <span>fixture {fixtureId}</span>
        </div>
      </div>
    </div>
  );
}
