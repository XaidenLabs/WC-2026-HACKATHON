"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { ArrowUp, ArrowDown, Check, X, RotateCcw, Flame, Trophy, Loader2 } from "lucide-react";
import type { HiLoMatch } from "@/app/api/pulse/hilo/route";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j?.error || `HTTP ${r.status}`), { code: j?.error });
    return j as { ok: boolean; matches: HiLoMatch[] };
  });

const CATS = [
  { id: "goals", label: "Goals", noun: "goals" },
  { id: "corners", label: "Corners", noun: "corners" },
  { id: "cards", label: "Cards", noun: "cards" },
] as const;
type CatId = (typeof CATS)[number]["id"];

const statOf = (m: HiLoMatch, cat: CatId) => m[cat];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function HiLoGame() {
  const { data, error, isLoading } = useSWR("/api/pulse/hilo", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const [category, setCategory] = useState<CatId>("goals");
  const [deck, setDeck] = useState<HiLoMatch[]>([]);
  const [idx, setIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [reveal, setReveal] = useState<{ correct: boolean; push: boolean } | null>(null);

  // Build / rebuild the deck whenever data arrives.
  const matches = data?.matches ?? [];
  useEffect(() => {
    if (matches.length) restart(matches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function restart(source: HiLoMatch[] = deck.length ? deck : matches) {
    setDeck(shuffle(source));
    setIdx(0);
    setStreak(0);
    setReveal(null);
  }

  function changeCategory(cat: CatId) {
    setCategory(cat);
    setIdx(0);
    setStreak(0);
    setReveal(null);
  }

  function guess(dir: "higher" | "lower") {
    if (reveal) return;
    const base = statOf(deck[idx], category);
    const target = statOf(deck[idx + 1], category);
    const push = target === base;
    const correct = push || (dir === "higher" ? target > base : target < base);
    setReveal({ correct, push });
    if (correct && !push) {
      const s = streak + 1;
      setStreak(s);
      setBest((b) => Math.max(b, s));
    } else if (!correct) {
      setStreak(0);
    }
  }

  function next() {
    setReveal(null);
    setIdx((i) => i + 1);
  }

  // ── States ──────────────────────────────────────────────────────────────────

  if (isLoading && !data) {
    return (
      <Center>
        <Loader2 className="size-5 animate-spin text-text-dim" aria-hidden />
      </Center>
    );
  }
  if (error || matches.length < 2) {
    return (
      <Center>
        <Trophy className="mb-3 size-7 text-text-dim" aria-hidden />
        <p className="text-sm font-medium text-text">Hi-Lo unlocks after kickoff</p>
        <p className="mt-1 max-w-[16rem] text-xs text-text-dim">
          We need at least two finished World Cup matches to start the game. Check back once the
          group stage is underway.
        </p>
      </Center>
    );
  }

  const noun = CATS.find((c) => c.id === category)!.noun;
  const baseline = deck[idx];
  const target = deck[idx + 1];
  const complete = !target;

  if (complete) {
    return (
      <div className="px-4 py-6">
        <CategoryTabs category={category} onChange={changeCategory} />
        <Center>
          <Trophy className="mb-3 size-8 text-signal" aria-hidden />
          <p className="text-base font-semibold text-text">Run complete!</p>
          <p className="mt-1 text-sm text-text-dim">
            Best streak this round: <span className="font-mono text-signal">{best}</span>
          </p>
          <button
            type="button"
            onClick={() => restart()}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
          >
            <RotateCcw className="size-4" aria-hidden /> Play again
          </button>
        </Center>
      </div>
    );
  }

  const baseVal = statOf(baseline, category);
  const targetVal = statOf(target, category);

  return (
    <div className="flex min-h-full flex-col px-4 py-5">
      <CategoryTabs category={category} onChange={changeCategory} />

      {/* Streak row */}
      <div className="mb-4 flex items-center justify-between font-mono text-xs">
        <span className="inline-flex items-center gap-1.5 text-signal">
          <Flame className="size-3.5" aria-hidden /> Streak {streak}
        </span>
        <span className="text-text-dim">Best {best}</span>
      </div>

      {/* Baseline */}
      <div className="rounded-2xl border border-line bg-ink-2 p-4 text-center">
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
          {baseline.p1} v {baseline.p2}
        </p>
        <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-text">{baseVal}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">{noun}</p>
      </div>

      {/* Question */}
      <div className="my-4 text-center">
        <p className="text-sm text-text-dim">Will this match have</p>
        <p className="text-base font-semibold text-text">
          higher or lower {noun}?
        </p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-text-dim">
          {target.p1} v {target.p2}
        </p>
      </div>

      {/* Target reveal */}
      <div
        className={`rounded-2xl border p-4 text-center transition-colors ${
          reveal
            ? reveal.correct
              ? "border-win/40 bg-win/8"
              : "border-live/40 bg-live/8"
            : "border-dashed border-line bg-ink-2"
        }`}
      >
        {reveal ? (
          <>
            <p className="font-mono text-4xl font-bold tabular-nums text-text">{targetVal}</p>
            <p
              className={`mt-1 inline-flex items-center gap-1.5 font-mono text-xs ${
                reveal.correct ? "text-win" : "text-live"
              }`}
            >
              {reveal.correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              {reveal.push ? "Push — exactly equal!" : reveal.correct ? "Correct!" : "Missed it"}
            </p>
          </>
        ) : (
          <p className="font-mono text-4xl font-bold text-text-dim">?</p>
        )}
      </div>

      {/* Controls */}
      <div className="mt-5">
        {reveal ? (
          <button
            type="button"
            onClick={next}
            className="w-full rounded-xl bg-signal py-3.5 text-base font-semibold text-ink transition-opacity hover:opacity-90"
          >
            Next match →
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => guess("higher")}
              className="flex flex-col items-center gap-1 rounded-xl border border-line bg-ink-2 py-4 font-semibold text-text transition-colors hover:border-win/50 hover:bg-win/8"
            >
              <ArrowUp className="size-6 text-win" aria-hidden />
              Higher
            </button>
            <button
              type="button"
              onClick={() => guess("lower")}
              className="flex flex-col items-center gap-1 rounded-xl border border-line bg-ink-2 py-4 font-semibold text-text transition-colors hover:border-live/50 hover:bg-live/8"
            >
              <ArrowDown className="size-6 text-live" aria-hidden />
              Lower
            </button>
          </div>
        )}
      </div>

      <p className="mt-5 text-center font-mono text-[10px] text-text-dim">
        Real final stats from TxLINE · {deck.length} matches in the deck
      </p>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function CategoryTabs({ category, onChange }: { category: CatId; onChange: (c: CatId) => void }) {
  return (
    <div className="mb-4 flex gap-1 rounded-lg border border-line bg-ink-2 p-1">
      {CATS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            category === c.id ? "bg-ink-3 text-text" : "text-text-dim hover:text-text"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      {children}
    </div>
  );
}
