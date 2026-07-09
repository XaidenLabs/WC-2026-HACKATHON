// ORA Sentinel — autonomous match-watching and settlement engine.
//
// Two modes:
//   replay  → play back historical TxLINE score events at speed (perfect for demo)
//   live    → poll /api/scores/snapshot every 30s for actual live matches
//
// When a stat is mathematically locked (e.g. 3 goals at 70' = "total > 2" can never flip)
// ORA early-settles without waiting for FT. When the match ends, it settles all remaining
// open pacts by fetching the Merkle proof and calling validate_stat + settle_pact.

import { getScoresSnapshot } from "@/lib/txline/server";
import { parseCurrentScore } from "@/lib/txline/types";
import type { TxScoreEvent } from "@/lib/txline/types";
import type { PactTermsArgs } from "@/lib/whistl/program";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KeeperEventKind =
  | "init"
  | "heartbeat"
  | "goal"
  | "goal_cancelled"
  | "corner"
  | "yellow_card"
  | "red_card"
  | "var"
  | "card"
  | "observation"
  | "prediction"
  | "early_settle"
  | "settle_start"
  | "settle_proof"
  | "settle_done"
  | "settle_error"
  | "finished";

export type KeeperEvent = {
  id: number;
  ts: number; // wall-clock ms
  kind: KeeperEventKind;
  message: string;
  pactId?: string;
  data?: Record<string, unknown>;
};

export type PactRecord = {
  pactId: string;
  fixtureId: number;
  terms: PactTermsArgs;
  stakeUsdc: number;
  statement: string;
  creatorWallet?: string;
  baselinePTrue: number; // from ORA quote at creation time
};

export type WatcherStatus = "watching" | "settling" | "done" | "error";

export type WatcherState = {
  fixtureId: number;
  p1: string;
  p2: string;
  pacts: PactRecord[];
  events: KeeperEvent[];
  status: WatcherStatus;
  startedAt: number;
  replaySpeed: number; // events/second in replay mode (0 = live)
  currentScore: { p1: number; p2: number; minutes: number } | null;
  settled: Set<string>; // pactIds that have been settled
};

// Hoist state onto globalThis so it survives Next.js Fast Refresh module re-execution.
type KeeperGlobal = {
  __keeperStore?: Map<number, WatcherState>;
  __keeperSeq?: { n: number };
};
const g = globalThis as typeof globalThis & KeeperGlobal;
if (!g.__keeperStore) g.__keeperStore = new Map();
if (!g.__keeperSeq) g.__keeperSeq = { n: 0 };
const store = g.__keeperStore;
const seq = g.__keeperSeq;

function nextId() {
  return ++seq.n;
}

// ─── Probability helpers ──────────────────────────────────────────────────────

function poissonPmf(k: number, lambda: number): number {
  if (k < 0) return 0;
  let log = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) log -= Math.log(i);
  return Math.exp(log);
}

// λ per 90 minutes for World Cup
const BASE_LAMBDA: Record<number, number> = {
  1: 1.3, 2: 1.3, // goals
  3: 1.95, 4: 1.95, // yellows
  5: 0.12, 6: 0.12, // reds
  7: 5.1, 8: 5.1,   // corners
};

/**
 * Given: current stat value, stat key, minutes elapsed, threshold, comparison —
 * return the updated P(true) considering how many stats are still expected.
 */
export function liveProb(
  currentValue: number,
  statKeyA: number,
  statKeyB: number | null,
  op: number | null, // 0 add, 1 subtract
  minutesElapsed: number,
  threshold: number,
  comparison: number, // 0 > | 1 < | 2 =
): number {
  const remaining = Math.max(0, 90 - minutesElapsed);
  const frac = remaining / 90;
  const lamA = (BASE_LAMBDA[statKeyA] ?? 1) * frac;
  const lamB = statKeyB != null ? (BASE_LAMBDA[statKeyB] ?? 1) * frac : 0;
  const lam = op === 0 ? lamA + lamB : lamA; // for margin, only consider A's remaining

  let p = 0;
  const CAP = 60;
  for (let extra = 0; extra <= CAP; extra++) {
    const finalValue = currentValue + extra;
    let matches = false;
    if (comparison === 0) matches = finalValue > threshold;
    else if (comparison === 1) matches = finalValue < threshold;
    else matches = finalValue === threshold;
    if (matches) p += poissonPmf(extra, lam);
  }
  return Math.min(0.99, Math.max(0.01, p));
}

/** Is this bet already determined? (can't flip regardless of future events) */
export function isIrreversible(
  currentValue: number,
  comparison: number,
  threshold: number,
): boolean {
  if (comparison === 0) return currentValue > threshold; // > threshold: already true, can only get higher
  if (comparison === 1) return currentValue >= threshold; // < threshold: already violated, won't decrease
  return false; // = can always be disputed until final whistle
}

// ─── Stat value calculator ────────────────────────────────────────────────────

function statValue(stats: Record<string, number>, terms: PactTermsArgs): number | null {
  const a = stats[String(terms.statAKey)];
  if (a == null) return null;
  if (!terms.hasStatB) return a;
  const b = stats[String(terms.statBKey)];
  if (b == null) return null;
  return terms.op === 0 ? a + b : a - b;
}

function pactResult(val: number, terms: PactTermsArgs): boolean {
  if (terms.comparison === 0) return val > terms.threshold;
  if (terms.comparison === 1) return val < terms.threshold;
  return val === terms.threshold;
}

// ─── ORA narration engine ────────────────────────────────────────────────────

function narratePact(
  pact: PactRecord,
  val: number | null,
  prob: number,
  irreversible: boolean,
  minutes: number,
): string {
  if (val == null) return `${pact.statement} · tracking (no data yet)`;
  const result = pactResult(val, pact.terms);
  if (irreversible) {
    return `${pact.statement} · LOCKED ${result ? "TRUE ✓" : "FALSE ✗"} (value: ${val}, can't flip with ${90 - minutes} min left)`;
  }
  const dir = result ? "tracking TRUE" : "tracking FALSE";
  return `${pact.statement} · ${dir} (value: ${val}, P(TRUE) ${(prob * 100).toFixed(1)}%)`;
}

// Running known totals — only updated when a field is actually present in the event.
// This avoids false GOAL CANCELLED events when Score.Total is absent in some events.
type ScoreState = {
  g1: number; g2: number;   // goals
  y1: number; y2: number;   // yellow cards
  r1: number; r2: number;   // red cards
  c1: number; c2: number;   // corners
};

function narrateScoreEvents(
  ev: TxScoreEvent,
  prev: ScoreState,
  p1: string,
  p2: string,
): { narrated: Array<{ kind: KeeperEventKind; msg: string }>; next: ScoreState } {
  const narrated: Array<{ kind: KeeperEventKind; msg: string }> = [];
  const mins = Math.floor((ev.Clock?.Seconds ?? 0) / 60);

  // Read only if the field is actually present — null means "no data in this event, keep prev"
  const g1 = ev.Score?.Participant1?.Total?.Goals  ?? null;
  const g2 = ev.Score?.Participant2?.Total?.Goals  ?? null;
  const y1 = ev.Score?.Participant1?.Total?.YellowCards ?? null;
  const y2 = ev.Score?.Participant2?.Total?.YellowCards ?? null;
  const r1 = ev.Score?.Participant1?.Total?.RedCards    ?? null;
  const r2 = ev.Score?.Participant2?.Total?.RedCards    ?? null;
  const c1 = ev.Score?.Participant1?.Total?.Corners ?? null;
  const c2 = ev.Score?.Participant2?.Total?.Corners ?? null;

  const cur1 = g1 ?? prev.g1;
  const cur2 = g2 ?? prev.g2;

  // Goals (fire only when the field is present AND changed)
  if (g1 !== null) {
    if (g1 > prev.g1) narrated.push({ kind: "goal",
      msg: `${mins}' GOAL · ${p1} scores!  ${p1} ${g1} - ${cur2} ${p2}` });
    else if (g1 < prev.g1) narrated.push({ kind: "goal_cancelled",
      msg: `${mins}' GOAL CANCELLED (VAR) · ${p1}.  Score: ${p1} ${g1} - ${cur2} ${p2}` });
  }
  if (g2 !== null) {
    if (g2 > prev.g2) narrated.push({ kind: "goal",
      msg: `${mins}' GOAL · ${p2} scores!  ${p1} ${cur1} - ${g2} ${p2}` });
    else if (g2 < prev.g2) narrated.push({ kind: "goal_cancelled",
      msg: `${mins}' GOAL CANCELLED (VAR) · ${p2}.  Score: ${p1} ${cur1} - ${g2} ${p2}` });
  }

  // Yellow cards
  if (y1 !== null && y1 > prev.y1) narrated.push({ kind: "yellow_card", msg: `${mins}' YELLOW CARD · ${p1}` });
  if (y2 !== null && y2 > prev.y2) narrated.push({ kind: "yellow_card", msg: `${mins}' YELLOW CARD · ${p2}` });

  // Red cards
  if (r1 !== null && r1 > prev.r1) narrated.push({ kind: "red_card", msg: `${mins}' RED CARD · ${p1}` });
  if (r2 !== null && r2 > prev.r2) narrated.push({ kind: "red_card", msg: `${mins}' RED CARD · ${p2}` });

  // Corners
  if (c1 !== null && c1 > prev.c1) narrated.push({ kind: "corner",
    msg: `${mins}' Corner · ${p1}  (${c1} total)` });
  if (c2 !== null && c2 > prev.c2) narrated.push({ kind: "corner",
    msg: `${mins}' Corner · ${p2}  (${c2} total)` });

  // GameState hints (VAR, half-time, kick-off, penalty)
  if (ev.GameState) {
    const gs = ev.GameState.toLowerCase();
    if (gs.includes("var") || gs.includes("review") || gs.includes("check")) {
      narrated.push({ kind: "var", msg: `${mins}' VAR review in progress...` });
    } else if (gs.includes("half time") || gs === "ht" || gs === "halftime") {
      narrated.push({ kind: "observation", msg: `${mins}' · Half time` });
    } else if (gs.includes("kick") || gs === "ko") {
      narrated.push({ kind: "init", msg: `Kick off · match has started` });
    } else if (gs.includes("penalty") && !gs.includes("shootout")) {
      narrated.push({ kind: "observation", msg: `${mins}' · Penalty kick awarded` });
    }
  }

  const next: ScoreState = {
    g1: g1 !== null ? g1 : prev.g1,
    g2: g2 !== null ? g2 : prev.g2,
    y1: y1 !== null ? y1 : prev.y1,
    y2: y2 !== null ? y2 : prev.y2,
    r1: r1 !== null ? r1 : prev.r1,
    r2: r2 !== null ? r2 : prev.r2,
    c1: c1 !== null ? c1 : prev.c1,
    c2: c2 !== null ? c2 : prev.c2,
  };
  return { narrated, next };
}

// ─── Store helpers ────────────────────────────────────────────────────────────

function push(fixtureId: number, kind: KeeperEventKind, message: string, extra?: Partial<KeeperEvent>) {
  const state = store.get(fixtureId);
  if (!state) return;
  const ev: KeeperEvent = { id: nextId(), ts: Date.now(), kind, message, ...extra };
  state.events.push(ev);
  // Keep last 500 events
  if (state.events.length > 500) state.events.splice(0, state.events.length - 500);
}

// ─── Settlement chain ────────────────────────────────────────────────────────

async function settlePact(
  fixtureId: number,
  pact: PactRecord,
  finalStats: Record<string, number>,
): Promise<void> {
  const state = store.get(fixtureId);
  if (!state || state.settled.has(pact.pactId)) return;
  state.settled.add(pact.pactId);

  const val = statValue(finalStats, pact.terms);
  if (val == null) {
    push(fixtureId, "settle_error", `Pact ${pact.pactId}: no stat data available`);
    return;
  }
  const isTrue = pactResult(val, pact.terms);

  push(fixtureId, "settle_start", `Settling pact ${pact.pactId}: "${pact.statement}" · final value: ${val} → ${isTrue ? "TRUE ✓" : "FALSE ✗"}`);

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  let txSig: string | null = null;

  // Detect demo pacts (non-numeric IDs like "demo-001") — skip on-chain, just log outcome.
  const isNumericId = /^\d+$/.test(pact.pactId);
  if (!isNumericId) {
    push(fixtureId, "settle_done",
      isTrue
        ? `[demo] ${pact.statement} = TRUE ✓ · creator wins ${pact.stakeUsdc * 2} USDC`
        : `[demo] ${pact.statement} = FALSE ✗ · ORA wins ${pact.stakeUsdc * 2} USDC`,
      { pactId: pact.pactId, data: { isTrue, val, demo: true, statement: pact.statement, totalPayout: pact.stakeUsdc * 2 } },
    );
  } else {
    // Step 1: Submit settle_pact on-chain via ORA (proof fetch + CPI validate_stat + payout).
    push(fixtureId, "settle_proof", `Fetching Merkle proof (statKey ${pact.terms.statAKey}${pact.terms.hasStatB ? `·${pact.terms.statBKey}` : ""}) from TxLINE…`);
    try {
      const settleRes = await fetch(`${BASE_URL}/api/ora/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pactId: pact.pactId,
          fixtureId,
          statAKey: pact.terms.statAKey,
          ...(pact.terms.hasStatB ? { statBKey: pact.terms.statBKey } : {}),
        }),
        cache: "no-store",
      }).catch(() => null);

      if (settleRes?.ok) {
        const result = await settleRes.json();
        txSig = result.sig ?? null;
        push(fixtureId, "settle_done",
          isTrue
            ? `✓ SETTLED ON-CHAIN · ${pact.statement} = TRUE · ${pact.stakeUsdc * 2} USDC → creator | tx: ${txSig}`
            : `✓ SETTLED ON-CHAIN · ${pact.statement} = FALSE · ${pact.stakeUsdc * 2} USDC → ORA | tx: ${txSig}`,
          { pactId: pact.pactId, data: { isTrue, val, txSig, statement: pact.statement, totalPayout: pact.stakeUsdc * 2 } },
        );
      } else {
        const errBody = await settleRes?.json().catch(() => ({}));
        const reason = errBody?.error ?? `HTTP ${settleRes?.status ?? "?"}`;
        if (reason === "PACT_NOT_ACCEPTED" || reason === "PACT_NOT_OPEN") {
          push(fixtureId, "settle_done",
            isTrue
              ? `[demo] ${pact.statement} = TRUE ✓ · creator wins ${pact.stakeUsdc * 2} USDC`
              : `[demo] ${pact.statement} = FALSE ✗ · ORA wins ${pact.stakeUsdc * 2} USDC`,
            { pactId: pact.pactId, data: { isTrue, val, demo: true, statement: pact.statement, totalPayout: pact.stakeUsdc * 2 } },
          );
        } else {
          push(fixtureId, "settle_error", `Settlement failed: ${reason}`, { pactId: pact.pactId });
        }
      }
    } catch (e) {
      push(fixtureId, "settle_error", `Settlement error: ${(e as Error).message}`, { pactId: pact.pactId });
    }
  }

  // Step 2: Update Supabase record (best-effort).
  fetch(`${BASE_URL}/api/pacts/${pact.pactId}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isTrue, finalValue: val, txSig }),
    cache: "no-store",
  }).catch(() => {});
}

// ─── Replay engine ────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runReplay(fixtureId: number, rawEvents: TxScoreEvent[]): Promise<void> {
  const state = store.get(fixtureId);
  if (!state) return;

  const eventsWithScore = rawEvents.filter((e) => e.Score != null || e.Clock != null);
  // Sort by Seq ascending (chronological)
  eventsWithScore.sort((a, b) => a.Seq - b.Seq);

  const pactList = state.pacts.length > 0
    ? `Tracking ${state.pacts.length} pact${state.pacts.length !== 1 ? "s" : ""}`
    : "No pacts attached · ORA watches for analysis only";

  push(fixtureId, "init", `ORA Sentinel online · ${eventsWithScore.length} match events loaded`);
  push(fixtureId, "init", pactList);

  let lastMinute = -1;
  let lastStats: Record<string, number> = {};
  let scoreState: ScoreState = { g1: 0, g2: 0, y1: 0, y2: 0, r1: 0, r2: 0, c1: 0, c2: 0 };
  let prevClockSeconds = eventsWithScore[0]?.Clock?.Seconds ?? 0;

  for (const ev of eventsWithScore) {
    if (state.status === "done") break;

    const currentClockSeconds = ev.Clock?.Seconds ?? prevClockSeconds;
    const clockDiffSeconds = Math.max(0, currentClockSeconds - prevClockSeconds);

    // Clock-based pacing: replaySpeed=3 → 1 match-minute = ~0.33 real seconds
    const delayMs = Math.max(250, Math.min(4000, (clockDiffSeconds * 1000) / (state.replaySpeed * 60)));

    const mins = Math.floor(currentClockSeconds / 60);
    const stats = ev.Stats ?? {};
    lastStats = { ...lastStats, ...stats };

    // Narrate goals, cards, corners, VAR — only fires when Score.Total fields are present
    const { narrated, next } = narrateScoreEvents(ev, scoreState, state.p1, state.p2);
    scoreState = next;
    for (const n of narrated) push(fixtureId, n.kind, n.msg);

    // Every ~10 minutes, emit a heartbeat with all pact probabilities
    if (mins > 0 && mins !== lastMinute && mins % 10 === 0) {
      lastMinute = mins;
      const goals1 = lastStats["1"] ?? ev.Score?.Participant1?.Total?.Goals ?? 0;
      const goals2 = lastStats["2"] ?? ev.Score?.Participant2?.Total?.Goals ?? 0;
      state.currentScore = { p1: goals1, p2: goals2, minutes: mins };

      const lines: string[] = [`${mins}' · Score: ${state.p1} ${goals1} - ${goals2} ${state.p2}`];
      for (const pact of state.pacts) {
        if (state.settled.has(pact.pactId)) continue;
        const val = statValue(lastStats, pact.terms);
        if (val == null) continue;
        const prob = liveProb(val, pact.terms.statAKey, pact.terms.hasStatB ? pact.terms.statBKey : null, pact.terms.op, mins, pact.terms.threshold, pact.terms.comparison);
        const irrev = isIrreversible(val, pact.terms.comparison, pact.terms.threshold);
        lines.push(`  · ${narratePact(pact, val, prob, irrev, mins)}`);

        // Early settle if irreversible
        if (irrev && !state.settled.has(pact.pactId)) {
          push(fixtureId, "early_settle", `${mins}' · "${pact.statement}" is ALREADY DECIDED (value: ${val}) · settling early`, { pactId: pact.pactId });
          await sleep(delayMs * 2);
          await settlePact(fixtureId, pact, lastStats);
        }
      }
      push(fixtureId, "heartbeat", lines.join("\n"), { data: { minutes: mins, goals1, goals2 } });
    }

    await sleep(delayMs);
    prevClockSeconds = currentClockSeconds;
  }

  const NINETY_MINS = 90 * 60;
  const MATCH_SPEED = state.replaySpeed * 60;

  // If the last event had the clock still running, the match is LIVE — switch to real polling
  const lastEvent = eventsWithScore[eventsWithScore.length - 1];
  const matchIsLive = lastEvent?.Clock?.Running === true && prevClockSeconds < NINETY_MINS;

  if (matchIsLive) {
    await runLivePolling(fixtureId, lastStats, prevClockSeconds);
    return;
  }

  // Match is finished or pre-match — if data ended before 90', wait out the clock with heartbeats
  if (prevClockSeconds < NINETY_MINS) {
    const lastMins = Math.floor(prevClockSeconds / 60);
    push(fixtureId, "observation", `${lastMins}' · Watching until full time…`);
    let simClock = prevClockSeconds;
    while (simClock < NINETY_MINS) {
      if (state.status === "done") break;
      const nextMark = Math.min(NINETY_MINS, simClock + 10 * 60);
      const gapDelay = Math.max(500, Math.min(4000, ((nextMark - simClock) * 1000) / MATCH_SPEED));
      await sleep(gapDelay);
      simClock = nextMark;
      const simMins = Math.floor(simClock / 60);
      const goals1 = lastStats["1"] ?? 0;
      const goals2 = lastStats["2"] ?? 0;
      state.currentScore = { p1: goals1, p2: goals2, minutes: simMins };
      if (simClock < NINETY_MINS) {
        push(fixtureId, "heartbeat", `${simMins}' · ${state.p1} ${goals1}-${goals2} ${state.p2}`,
          { data: { minutes: simMins, goals1, goals2 } });
      } else {
        push(fixtureId, "finished", `90' · Match completed.  ${state.p1} ${goals1} - ${goals2} ${state.p2}`,
          { data: { minutes: 90, goals1, goals2 } });
      }
    }
  }

  // Final settlement
  const finalStats = lastStats;
  const finalGoals1 = finalStats["1"] ?? 0;
  const finalGoals2 = finalStats["2"] ?? 0;
  state.currentScore = { p1: finalGoals1, p2: finalGoals2, minutes: 90 };
  if (prevClockSeconds >= NINETY_MINS) {
    push(fixtureId, "finished", `90' · Match completed.  ${state.p1} ${finalGoals1} - ${finalGoals2} ${state.p2}`);
  }
  state.status = "settling";
  const settlePause = Math.max(500, Math.min(3000, (5 * 1000) / MATCH_SPEED));
  for (const pact of state.pacts) {
    if (state.settled.has(pact.pactId)) continue;
    await sleep(settlePause);
    await settlePact(fixtureId, pact, finalStats);
  }
  state.status = "done";
  push(fixtureId, "finished", `All ${state.pacts.length} pact${state.pacts.length !== 1 ? "s" : ""} settled. ORA Sentinel done.`);
}

// ─── Live polling engine ──────────────────────────────────────────────────────

async function runLivePolling(
  fixtureId: number,
  initialStats: Record<string, number>,
  startClockSeconds: number,
): Promise<void> {
  const state = store.get(fixtureId);
  if (!state) return;

  const startMins = Math.floor(startClockSeconds / 60);
  push(fixtureId, "observation",
    `${startMins}' · Match is LIVE. Polling TxLINE for real-time updates every 15s`);

  // Fetch a baseline snapshot NOW so we diff against actual current state,
  // not the potentially-stale Stats dict from the historical replay.
  let prevGoals1 = 0, prevGoals2 = 0;
  let prevYellow1 = 0, prevYellow2 = 0;
  let prevRed1 = 0, prevRed2 = 0;
  let prevCorners1 = 0, prevCorners2 = 0;
  let prevMins = startMins;
  try {
    const baseSnap = (await getScoresSnapshot(fixtureId)) as TxScoreEvent[];
    const base = parseCurrentScore(baseSnap);
    if (base) {
      prevGoals1   = base.p1Goals;   prevGoals2   = base.p2Goals;
      prevYellow1  = base.p1Yellow;  prevYellow2  = base.p2Yellow;
      prevRed1     = base.stats["5"] ?? 0; prevRed2 = base.stats["6"] ?? 0;
      prevCorners1 = base.p1Corners; prevCorners2 = base.p2Corners;
      prevMins     = base.minutes;
      state.currentScore = { p1: base.p1Goals, p2: base.p2Goals, minutes: base.minutes };
    }
  } catch { /* use zeros as baseline if snapshot fails */ }

  // Poll until finished — cap at ~25 min of stoppage (100 polls × 15s)
  for (let poll = 0; poll < 100; poll++) {
    if (state.status === "done") break;
    await sleep(15_000);

    let snapshot: TxScoreEvent[];
    try {
      snapshot = (await getScoresSnapshot(fixtureId)) as TxScoreEvent[];
    } catch (e) {
      push(fixtureId, "observation", `[poll ${poll + 1}] TxLINE error · ${(e as Error).message}`);
      continue;
    }

    const current = parseCurrentScore(snapshot);
    if (!current) continue;

    const mins = current.minutes;
    state.currentScore = { p1: current.p1Goals, p2: current.p2Goals, minutes: mins };

    const currRed1    = current.stats["5"] ?? 0;
    const currRed2    = current.stats["6"] ?? 0;

    // Goals — only fire when the count actually changes
    if (current.p1Goals > prevGoals1) {
      for (let i = prevGoals1; i < current.p1Goals; i++)
        push(fixtureId, "goal",
          `${mins}' GOAL · ${state.p1} scores!  ${state.p1} ${current.p1Goals} - ${current.p2Goals} ${state.p2}`);
    } else if (current.p1Goals < prevGoals1) {
      push(fixtureId, "goal_cancelled",
        `${mins}' GOAL CANCELLED (VAR) · ${state.p1}.  Score: ${state.p1} ${current.p1Goals} - ${current.p2Goals} ${state.p2}`);
    }
    if (current.p2Goals > prevGoals2) {
      for (let i = prevGoals2; i < current.p2Goals; i++)
        push(fixtureId, "goal",
          `${mins}' GOAL · ${state.p2} scores!  ${state.p1} ${current.p1Goals} - ${current.p2Goals} ${state.p2}`);
    } else if (current.p2Goals < prevGoals2) {
      push(fixtureId, "goal_cancelled",
        `${mins}' GOAL CANCELLED (VAR) · ${state.p2}.  Score: ${state.p1} ${current.p1Goals} - ${current.p2Goals} ${state.p2}`);
    }

    // Cards
    if (current.p1Yellow > prevYellow1) push(fixtureId, "yellow_card", `${mins}' YELLOW CARD · ${state.p1}`);
    if (current.p2Yellow > prevYellow2) push(fixtureId, "yellow_card", `${mins}' YELLOW CARD · ${state.p2}`);
    if (currRed1 > prevRed1) push(fixtureId, "red_card", `${mins}' RED CARD · ${state.p1}`);
    if (currRed2 > prevRed2) push(fixtureId, "red_card", `${mins}' RED CARD · ${state.p2}`);

    // Corners
    if (current.p1Corners > prevCorners1) push(fixtureId, "corner",
      `${mins}' Corner · ${state.p1}  (${current.p1Corners} total)`);
    if (current.p2Corners > prevCorners2) push(fixtureId, "corner",
      `${mins}' Corner · ${state.p2}  (${current.p2Corners} total)`);

    // Score ticker every 10 match-minutes (or every 5 in the final 10)
    if (Math.floor(mins / 10) > Math.floor(prevMins / 10) ||
        (mins >= 80 && mins > prevMins && mins % 5 === 0)) {
      push(fixtureId, "heartbeat",
        `${mins}' · ${state.p1} ${current.p1Goals} - ${current.p2Goals} ${state.p2}`,
        { data: { minutes: mins, goals1: current.p1Goals, goals2: current.p2Goals } });
    }

    prevGoals1   = current.p1Goals;   prevGoals2   = current.p2Goals;
    prevYellow1  = current.p1Yellow;  prevYellow2  = current.p2Yellow;
    prevRed1     = currRed1;          prevRed2     = currRed2;
    prevCorners1 = current.p1Corners; prevCorners2 = current.p2Corners;
    prevMins     = mins;

    // Settle when match clock stops at or past 90'
    if (current.isFinished || (mins >= 90 && !current.clockRunning)) {
      const finalStats: Record<string, number> = {
        "1": current.p1Goals,   "2": current.p2Goals,
        "3": current.p1Yellow,  "4": current.p2Yellow,
        "5": currRed1,          "6": currRed2,
        "7": current.p1Corners, "8": current.p2Corners,
      };
      push(fixtureId, "finished",
        `90' · Match completed.  ${state.p1} ${current.p1Goals} - ${current.p2Goals} ${state.p2}`);
      state.currentScore = { p1: current.p1Goals, p2: current.p2Goals, minutes: 90 };
      state.status = "settling";
      for (const pact of state.pacts) {
        if (state.settled.has(pact.pactId)) continue;
        await sleep(800);
        await settlePact(fixtureId, pact, finalStats);
      }
      state.status = "done";
      push(fixtureId, "finished",
        `All ${state.pacts.length} pact${state.pacts.length !== 1 ? "s" : ""} settled. ORA Sentinel done.`);
      return;
    }
  }

  // Polling cap reached — settle with what we have
  if (state.status !== "done") {
    push(fixtureId, "finished",
      `90' · Match completed.  ${state.p1} ${prevGoals1} - ${prevGoals2} ${state.p2}`);
    state.status = "settling";
    const finalStats: Record<string, number> = {
      "1": prevGoals1,   "2": prevGoals2,
      "3": prevYellow1,  "4": prevYellow2,
      "5": prevRed1,     "6": prevRed2,
    };
    for (const pact of state.pacts) {
      if (state.settled.has(pact.pactId)) continue;
      await sleep(800);
      await settlePact(fixtureId, pact, finalStats);
    }
    state.status = "done";
    push(fixtureId, "finished",
      `All ${state.pacts.length} pact${state.pacts.length !== 1 ? "s" : ""} settled. ORA Sentinel done.`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startWatch(
  fixtureId: number,
  p1: string,
  p2: string,
  pacts: PactRecord[],
  replaySpeed = 8, // events per second
): WatcherState {
  const existing = store.get(fixtureId);
  if (existing) return existing;
  const state: WatcherState = {
    fixtureId, p1, p2, pacts,
    events: [],
    status: "watching",
    startedAt: Date.now(),
    replaySpeed,
    currentScore: null,
    settled: new Set(),
  };
  store.set(fixtureId, state);
  return state;
}

export function getEvents(fixtureId: number, since = 0): KeeperEvent[] {
  return (store.get(fixtureId)?.events ?? []).filter((e) => e.id > since);
}

export function getState(fixtureId: number): WatcherState | undefined {
  return store.get(fixtureId);
}

export function getAllWatchers(): WatcherState[] {
  return [...store.values()];
}

export function clearWatcher(fixtureId: number) {
  store.delete(fixtureId);
}
