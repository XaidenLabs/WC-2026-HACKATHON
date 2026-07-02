"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { KeeperEvent, KeeperEventKind, WatcherStatus } from "@/lib/ora/keeper";
import type { PactRecord } from "@/lib/ora/keeper";

// ─── Types ────────────────────────────────────────────────────────────────────

type WatcherMeta = {
  fixtureId: number;
  p1: string;
  p2: string;
  status: WatcherStatus;
  pactCount: number;
  settledCount: number;
  startedAt: number;
  currentScore: { p1: number; p2: number; minutes: number } | null;
  lastEventId: number;
};

type SentinelState = {
  watcher: WatcherMeta;
  events: KeeperEvent[];
  lastId: number;
  settled: string[];
};

// ─── Demo launcher ───────────────────────────────────────────────────────────

const DEMO_FIXTURES = [
  {
    fixtureId: 17588234,
    p1: "Norway",
    p2: "France",
    pacts: [
      {
        pactId: "demo-001",
        fixtureId: 17588234,
        statement: "France goals − Norway goals > 0",
        terms: { statAKey: 2, statBKey: 1, hasStatB: true, op: 1, comparison: 0, threshold: 0, statAPeriod: 0, statBPeriod: 0 },
        stakeUsdc: 10,
        baselinePTrue: 0.728,
      },
      {
        pactId: "demo-002",
        fixtureId: 17588234,
        statement: "Total goals > 2",
        terms: { statAKey: 1, statBKey: 2, hasStatB: true, op: 0, comparison: 0, threshold: 2, statAPeriod: 0, statBPeriod: 0 },
        stakeUsdc: 10,
        baselinePTrue: 0.481,
      },
      {
        pactId: "demo-003",
        fixtureId: 17588234,
        statement: "Norway corners − France corners > 1",
        terms: { statAKey: 7, statBKey: 8, hasStatB: true, op: 1, comparison: 0, threshold: 1, statAPeriod: 0, statBPeriod: 0 },
        stakeUsdc: 10,
        baselinePTrue: 0.218,
      },
    ] as PactRecord[],
  },
];

// ─── Event colours / icons ────────────────────────────────────────────────────

function eventStyle(kind: KeeperEventKind): { color: string; prefix: string } {
  switch (kind) {
    case "init":         return { color: "#a3a3a3", prefix: "[ORA]" };
    case "heartbeat":    return { color: "#6b7280", prefix: "[tick]" };
    case "goal":         return { color: "#f59e0b", prefix: "[GOAL]" };
    case "card":         return { color: "#f97316", prefix: "[card]" };
    case "corner":       return { color: "#6b7280", prefix: "[cnr]" };
    case "observation":  return { color: "#9ca3af", prefix: "[obs]" };
    case "prediction":   return { color: "#38bdf8", prefix: "[pred]" };
    case "early_settle": return { color: "#a78bfa", prefix: "[LOCK]" };
    case "settle_start": return { color: "#34d399", prefix: "[sett]" };
    case "settle_proof": return { color: "#6ee7b7", prefix: "[proof]" };
    case "settle_done":  return { color: "#4ade80", prefix: "[DONE]" };
    case "settle_error": return { color: "#f87171", prefix: "[ERR]" };
    case "finished":     return { color: "#4ade80", prefix: "[END]" };
    default:             return { color: "#6b7280", prefix: "[...]" };
  }
}

function statusBadge(status: WatcherStatus) {
  if (status === "watching") return { label: "● LIVE", color: "#4ade80" };
  if (status === "settling") return { label: "● SETTLING", color: "#a78bfa" };
  if (status === "done")     return { label: "✓ DONE", color: "#6b7280" };
  return { label: "✗ ERROR", color: "#f87171" };
}

// ─── Sentinel panel ──────────────────────────────────────────────────────────

function SentinelPanel({ fixtureId }: { fixtureId: number }) {
  const [state, setState] = useState<SentinelState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  useEffect(() => {
    let alive = true;
    let done = false;
    async function poll() {
      while (alive) {
        try {
          const res = await fetch(
            `/api/ora/events/${fixtureId}?since=${lastIdRef.current}`,
            { cache: "no-store" },
          );
          if (!res.ok) {
            if (res.status === 404) {
              setErr("Sentinel not running for this fixture. Start a demo below.");
            }
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          const json = await res.json();
          if (json.ok) {
            setErr(null);
            done = json.status === "done";
            const newEvents: KeeperEvent[] = json.events ?? [];
            if (newEvents.length > 0) {
              lastIdRef.current = newEvents.at(-1)!.id;
              setState((prev) => {
                const base = prev ?? {
                  watcher: {
                    fixtureId, p1: "", p2: "",
                    status: json.status, pactCount: 0, settledCount: 0,
                    startedAt: Date.now(), currentScore: null, lastEventId: 0,
                  },
                  events: [], lastId: 0, settled: [],
                };
                return {
                  ...base,
                  watcher: { ...base.watcher, status: json.status, currentScore: json.currentScore ?? base.watcher.currentScore },
                  events: [...base.events, ...newEvents]
                .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
                .slice(-300),
                  settled: json.settled ?? base.settled,
                  lastId: lastIdRef.current,
                };
              });
            } else {
              setState((prev) => prev ? { ...prev, watcher: { ...prev.watcher, status: json.status } } : prev);
            }
            // Refresh watcher meta every few polls
            if (newEvents.length > 0 || done) {
              const metaRes = await fetch("/api/ora/keeper", { cache: "no-store" });
              if (metaRes.ok) {
                const meta = await metaRes.json();
                const watcher = (meta.watchers ?? []).find((w: WatcherMeta) => w.fixtureId === fixtureId);
                if (watcher) {
                  setState((prev) => prev ? { ...prev, watcher } : prev);
                }
              }
            }
          }
        } catch {
          // network error — retry
        }
        await new Promise((r) => setTimeout(r, done ? 5000 : 1200));
      }
    }
    poll();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state?.events.length]);

  if (err) {
    return (
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6b7280", padding: "12px 0" }}>
        {err}
      </div>
    );
  }

  if (!state) {
    return (
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6b7280", padding: "12px 0" }}>
        Connecting to ORA Sentinel…
      </div>
    );
  }

  const badge = statusBadge(state.watcher.status);

  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #1f2937", borderRadius: 8, overflow: "hidden" }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 14px", borderBottom: "1px solid #1f2937",
        background: "#111827",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: badge.color, fontWeight: 500 }}>
          {badge.label}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#4b5563" }}>
          {state.watcher.p1 || `fixture #${fixtureId}`} vs {state.watcher.p2}
        </span>
        {state.watcher.currentScore && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#f59e0b", marginLeft: "auto" }}>
            {state.watcher.p1} {state.watcher.currentScore.p1} - {state.watcher.currentScore.p2} {state.watcher.p2}
            {state.watcher.status !== "done" && ` (${state.watcher.currentScore.minutes}')`}
          </span>
        )}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#374151", marginLeft: state.watcher.currentScore ? 0 : "auto" }}>
          {state.watcher.settledCount}/{state.watcher.pactCount} settled
        </span>
      </div>

      {/* Event log */}
      <div
        ref={logRef}
        style={{
          height: 380, overflowY: "auto", padding: "10px 14px",
          fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.75,
          scrollbarWidth: "thin", scrollbarColor: "#1f2937 transparent",
        }}
      >
        {state.events.length === 0 && (
          <span style={{ color: "#374151" }}>Waiting for match events…</span>
        )}
        {state.events.map((ev) => {
          const { color, prefix } = eventStyle(ev.kind);
          const time = new Date(ev.ts).toISOString().substr(11, 8);
          const isHighlight = ["goal", "early_settle", "settle_done", "finished"].includes(ev.kind);
          const txSig = ev.kind === "settle_done" ? (ev.data?.txSig as string | undefined) : undefined;
          return (
            <div key={`${ev.id}-${ev.ts}`} style={{
              display: "flex", gap: 8, flexDirection: "column",
              background: isHighlight ? "rgba(255,255,255,0.03)" : "transparent",
              borderLeft: isHighlight ? `2px solid ${color}` : "2px solid transparent",
              paddingLeft: 6,
              marginBottom: isHighlight ? 4 : 0,
              paddingBottom: txSig ? 4 : 0,
            }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#374151", flexShrink: 0, userSelect: "none" }}>{time}</span>
                <span style={{ color, flexShrink: 0, userSelect: "none" }}>{prefix}</span>
                <span style={{ color: isHighlight ? "#e5e7eb" : "#9ca3af", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {ev.message}
                </span>
              </div>
              {txSig && (
                <div style={{ paddingLeft: 72, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#4b5563", fontSize: 10 }}>tx:</span>
                  <span style={{ color: "#9ca3af", fontSize: 10 }}>{txSig.slice(0, 12)}…{txSig.slice(-8)}</span>
                  <a
                    href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#4ade80", fontSize: 10, textDecoration: "none" }}
                  >
                    ↗ explorer
                  </a>
                </div>
              )}
            </div>
          );
        })}
        {state.watcher.status === "done" && (
          <div style={{ color: "#4ade80", marginTop: 8, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
            All pacts settled. ORA Sentinel complete.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Demo launcher button ─────────────────────────────────────────────────────

function DemoLauncher({ demo, onStart }: {
  demo: typeof DEMO_FIXTURES[0];
  onStart: (fixtureId: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  async function launch() {
    setLoading(true);
    try {
      const res = await fetch("/api/ora/keeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixtureId: demo.fixtureId,
          p1: demo.p1,
          p2: demo.p2,
          pacts: demo.pacts,
          speed: 6,
        }),
      });
      const json = await res.json();
      if (json.ok || json.resumed) {
        setStarted(true);
        onStart(demo.fixtureId);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 8,
      padding: "16px 20px", marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#93c5fd", fontWeight: 500 }}>
            {demo.p1} vs {demo.p2}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#475569", marginTop: 2 }}>
            {demo.pacts.length} pacts · replay at 6× speed
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {demo.pacts.map((p) => (
              <span key={p.pactId} style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                background: "#1e3a5f", color: "#93c5fd",
                padding: "2px 8px", borderRadius: 4,
              }}>
                &ldquo;{p.statement}&rdquo; P={Math.round(p.baselinePTrue * 100)}%
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={launch}
          disabled={loading || started}
          style={{
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
            background: started ? "#064e3b" : "#0f4c8a",
            color: started ? "#34d399" : "#93c5fd",
            border: `1px solid ${started ? "#065f46" : "#1e3a5f"}`,
            borderRadius: 6, padding: "8px 16px",
            cursor: started ? "default" : "pointer",
            whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          {loading ? "Launching…" : started ? "Watching ●" : "Launch Sentinel"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function OraPageInner() {
  const searchParams = useSearchParams();
  const qFixtureId = searchParams.get("fixtureId") ? Number(searchParams.get("fixtureId")) : null;

  const [activeFixtureId, setActiveFixtureId] = useState<number | null>(qFixtureId);
  const [watchers, setWatchers] = useState<WatcherMeta[]>([]);

  // On mount, check for any already-running watchers
  useEffect(() => {
    fetch("/api/ora/keeper", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.watchers.length > 0) {
          setWatchers(j.watchers);
          if (!activeFixtureId) setActiveFixtureId(j.watchers[0].fixtureId);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStart(fixtureId: number) {
    setActiveFixtureId(fixtureId);
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Link href="/" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#4b5563", textDecoration: "none" }}>
            ← home
          </Link>
        </div>
        <h1 style={{
          fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500,
          color: "#e5e7eb", margin: 0, letterSpacing: "-0.5px",
        }}>
          ORA Sentinel
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6b7280", margin: "8px 0 0" }}>
          Autonomous match-watcher and settlement engine. ORA watches every event,
          updates its certainty for each open pact, and settles on-chain the moment
          an outcome is mathematically determined — no human intervention required.
        </p>
      </div>

      {/* Live terminals (if any watchers are running) */}
      {(activeFixtureId || watchers.length > 0) && (
        <section style={{ marginBottom: 32 }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, color: "#4b5563",
            textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12,
          }}>
            Active sentinel
          </div>
          <SentinelPanel fixtureId={activeFixtureId ?? watchers[0].fixtureId} />
        </section>
      )}

      {/* Demo launcher */}
      <section>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10, color: "#4b5563",
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12,
        }}>
          Demo replays
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#4b5563", marginBottom: 16, marginTop: 0 }}>
          Replays a finished match at 6× speed with open pacts. ORA narrates every
          goal and update, early-settles locked outcomes, and fetches Merkle proofs at FT.
        </p>
        {DEMO_FIXTURES.map((demo) => (
          <DemoLauncher key={demo.fixtureId} demo={demo} onStart={handleStart} />
        ))}
      </section>

      {/* How it works */}
      <section style={{ marginTop: 40, paddingTop: 28, borderTop: "1px solid #1f2937" }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10, color: "#4b5563",
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16,
        }}>
          How it works
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            ["Watch", "Polls TxLINE scores every event. Narrates goals, cards, corners relevant to open pacts."],
            ["Update", "Bayesian probability update after every goal. P(TRUE) recalculated from remaining Poisson λ."],
            ["Early-settle", "When a stat is mathematically locked (e.g. 3 goals at 70' = total > 2 can never flip), ORA settles immediately."],
            ["Prove + pay", "At FT: fetches the 3-stage Merkle proof from TxLINE, calls validate_stat on devnet, executes settle_pact."],
          ].map(([title, desc]) => (
            <div key={title} style={{
              background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 8,
              padding: "14px 16px",
            }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#93c5fd", fontWeight: 500, marginBottom: 6 }}>
                {title}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#475569", lineHeight: 1.6 }}>
                {desc}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function OraPage() {
  return (
    <Suspense fallback={
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6b7280" }}>Loading…</div>
      </main>
    }>
      <OraPageInner />
    </Suspense>
  );
}
