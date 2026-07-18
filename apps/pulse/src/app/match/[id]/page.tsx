"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Sparkles, RefreshCw, Loader2, TrendingUp, Radio, AlertTriangle, Play } from "lucide-react";
import type { TxFixture } from "@/lib/txline/types";
import type { CommentaryCard } from "@/lib/pulse/commentary";
import { readFanScore, settleFanPrediction, type FanScore } from "@/lib/pulse/fan-score";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Score = {
  p1Goals: number;
  p2Goals: number;
  p1Corners: number;
  p2Corners: number;
  minute: number | null;
  phase: "live" | "upcoming" | "finished";
};

type CommentaryResp = {
  ok: boolean;
  card?: CommentaryCard;
  score?: Score;
  p1?: string;
  p2?: string;
  competition?: string;
  error?: string;
};

export default function MatchView() {
  const { id } = useParams<{ id: string }>();
  const fixtureId = Number(id);

  const { data: fxData } = useSWR<{ ok: boolean; fixtures: TxFixture[] }>(
    "/api/txline/fixtures",
    fetcher,
    { revalidateOnFocus: false },
  );
  const fixture = fxData?.fixtures?.find((f) => f.FixtureId === fixtureId);

  // Fetch history of commentaries
  const { data: commentariesData, mutate: mutateCommentaries } = useSWR<{ ok: boolean; commentaries: (CommentaryCard & { timestamp: number; signature?: string | null })[] }>(
    Number.isFinite(fixtureId) ? `/api/pulse/commentaries?fixtureId=${fixtureId}` : null,
    fetcher,
    { refreshInterval: 15000 } // Poll for updates every 15s
  );

  // Fetch Odds for Whale Alerts
  const { data: oddsData } = useSWR<{ ok: boolean; odds: { home: number, draw: number, away: number } }>(
    Number.isFinite(fixtureId) ? `/api/txline/odds?fixtureId=${fixtureId}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const [resp, setResp] = useState<CommentaryResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ranOnce = useRef(false);

  const p1 = resp?.p1 ?? fixture?.Participant1 ?? "Home";
  const p2 = resp?.p2 ?? fixture?.Participant2 ?? "Away";
  const competition = resp?.competition ?? fixture?.Competition;
  const score = resp?.score;
  const card = resp?.card;

  const fetchedList = commentariesData?.commentaries ?? [];
  const showOptimistic = card && (!fetchedList.length || fetchedList[0].headline !== card.headline);

  // --- WOW FEATURE 1: Sharp Money Whale Alert ---
  const prevOdds = useRef<{ home: number, draw: number, away: number } | null>(null);
  const [whaleAlert, setWhaleAlert] = useState<string | null>(null);

  useEffect(() => {
    if (oddsData?.odds && prevOdds.current) {
      const { home, away } = oddsData.odds;
      const prev = prevOdds.current;
      // Real sharp-money detection: fires when the live TxLINE line shortens hard (≥0.5)
      // between two polls — a genuine market move, not a simulated one.
      if (prev.home - home >= 0.5) {
        setWhaleAlert(`🚨 SHARP MOVE: money piling onto ${p1} · odds shortened ${prev.home.toFixed(2)} → ${home.toFixed(2)}`);
        setTimeout(() => setWhaleAlert(null), 8000);
      } else if (prev.away - away >= 0.5) {
        setWhaleAlert(`🚨 SHARP MOVE: money piling onto ${p2} · odds shortened ${prev.away.toFixed(2)} → ${away.toFixed(2)}`);
        setTimeout(() => setWhaleAlert(null), 8000);
      }
    }
    if (oddsData?.odds) {
      prevOdds.current = oddsData.odds;
    }
  }, [oddsData, p1, p2]);

  // --- WOW FEATURE 2: Micro-Predictions ---
  const [prediction, setPrediction] = useState<{ minute: number, targetCorners: number } | null>(null);
  const [fanScore, setFanScore] = useState<FanScore>(() => readFanScore());
  const handlePredict = () => {
    if (!score) return;
    setPrediction({ minute: score.minute ?? 0, targetCorners: score.p1Corners + score.p2Corners });
  };
  const predictionStatus = !prediction || !score
    ? null
    : score.p1Corners + score.p2Corners > prediction.targetCorners && (score.minute ?? 0) <= prediction.minute + 10
      ? "won"
      : (score.minute ?? 0) > prediction.minute + 10
        ? "lost"
        : "pending";

  useEffect(() => {
    if (!prediction || !predictionStatus || predictionStatus === "pending") return;
    const awardId = `${fixtureId}:${prediction.minute}:${prediction.targetCorners}`;
    const timer = window.setTimeout(() => {
      setFanScore(settleFanPrediction(awardId, predictionStatus === "won"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fixtureId, prediction, predictionStatus]);

  // --- WOW FEATURE 3: Audio AI Commentator ---
  const playTTS = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 0.95;
      const voices = window.speechSynthesis.getVoices();
      // Try to find a British voice for authentic football feel
      const ukVoice = voices.find(v => v.lang.includes("en-GB") || v.name.includes("UK"));
      if (ukVoice) utterance.voice = ukVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  const generate = useCallback(async () => {
    setLoading(true);
    setResp(null);
    setError(null);
    try {
      const r = await fetch("/api/pulse/commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixtureId,
          p1: fixture?.Participant1,
          p2: fixture?.Participant2,
          competition: fixture?.Competition,
        }),
      });
      const j = (await r.json()) as CommentaryResp;
      if (j.ok) {
        setResp(j);
        // Play Audio automatically when it generates (browser policies permitting)
        if (j.card) playTTS(j.card.headline + "... " + j.card.analysis);
        setTimeout(() => mutateCommentaries(), 3000);
      }
      else setError(j.error ?? "Failed to generate commentary");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fixtureId, fixture, mutateCommentaries]);

  useEffect(() => {
    if (ranOnce.current || !Number.isFinite(fixtureId)) return;
    ranOnce.current = true;
    generate();
  }, [fixtureId, generate]);

  return (
    <div className="px-4 py-5 relative">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Feed
      </Link>

      {/* Whale Alert Banner */}
      {whaleAlert && (
        <div className="mb-4 animate-in fade-in slide-in-from-top-2 rounded-xl bg-gradient-to-r from-live/20 to-transparent border-l-4 border-live p-4 flex items-start gap-3 shadow-lg">
          <AlertTriangle className="size-5 text-live shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-text">{whaleAlert}</p>
        </div>
      )}

      {/* Header */}
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
        {competition ?? "World Cup"}
      </p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-text">
        {p1} <span className="text-text-dim">v</span> {p2}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-text-dim">
        <span className="rounded-full border border-line bg-ink-2 px-2 py-1">TXLINE · fixture #{fixtureId}</span>
        <span className="rounded-full border border-proof/30 bg-proof/5 px-2 py-1 text-proof">Fan score {fanScore.points} · {fanScore.wins} wins</span>
      </div>

      {/* Score banner */}
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-ink-2 px-5 py-4">
        <ScoreSide name={p1} goals={score?.p1Goals} />
        <div className="text-center">
          {score?.phase === "live" ? (
            <span className="flex items-center gap-1 font-mono text-xs text-signal">
              <span className="size-1.5 animate-livedot rounded-full bg-signal" aria-hidden />
              {score.minute ?? 0}&apos;
            </span>
          ) : score?.phase === "finished" ? (
            <span className="font-mono text-xs text-text-dim">FT</span>
          ) : (
            <span className="font-mono text-xs text-text-dim">·</span>
          )}
        </div>
        <ScoreSide name={p2} goals={score?.p2Goals} alignRight />
      </div>

      {score && (score.p1Corners > 0 || score.p2Corners > 0) && (
        <p className="mt-2 text-center font-mono text-[10px] text-text-dim">
          Corners {score.p1Corners}–{score.p2Corners}
        </p>
      )}

      {/* Micro Prediction Widget */}
      {score?.phase === "live" && (
        <div className="mt-4 rounded-2xl border border-signal/30 bg-signal/5 p-4">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-signal mb-2">Quick Predict</h3>
          {!prediction ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text">Will there be a corner in the next 10 mins?</p>
              <button 
                onClick={handlePredict}
                className="px-4 py-1.5 bg-signal text-ink text-xs font-bold rounded-lg shadow-[0_0_15px_rgba(7,238,166,0.3)] hover:opacity-90 transition-opacity"
              >
                Yes
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-dim">Your Prediction</p>
                <p className="text-sm text-text font-medium">Corner before {prediction.minute + 10}&apos;</p>
              </div>
              <div className="text-right">
                {predictionStatus === "pending" && <span className="text-xs font-mono text-signal animate-pulse">Monitoring...</span>}
                {predictionStatus === "won" && <span className="text-xs font-mono text-proof font-bold">WON! +100 pts</span>}
                {predictionStatus === "lost" && <span className="text-xs font-mono text-live font-bold">MISSED · score unchanged</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI pundit card */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-text-dim">
          <Sparkles className="size-3.5 text-proof" aria-hidden /> AI Match Commentary
        </h2>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 font-mono text-[10px] text-text-dim transition-colors hover:text-text disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-3" aria-hidden />
          )}
          Refresh
        </button>
      </div>

      {loading && <CardSkeleton />}
      {error && (
        <p className="mt-2 rounded-xl border border-live/30 bg-live/5 p-4 text-sm text-live">
          {error === "TXLINE_TOKEN_MISSING" ? "Live data warming up · try again shortly." : error}
        </p>
      )}

      <div className="mt-2 space-y-3 pb-24">
        {showOptimistic && (
          <CommentaryCardView card={card!} onPlayTTS={() => playTTS(card!.headline + "... " + card!.analysis)} />
        )}
        
        {fetchedList.map((c, i) => (
          <CommentaryCardView key={i} card={c} timestamp={c.timestamp} signature={c.signature} onPlayTTS={() => playTTS(c.headline + "... " + c.analysis)} />
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-ink via-ink to-transparent pt-12 pb-6 px-4 pointer-events-none flex justify-center z-10">
        <p className="flex items-center gap-1.5 font-mono text-[10px] text-text-dim/80 pointer-events-auto bg-ink/80 px-3 py-1.5 rounded-full border border-line/50 backdrop-blur-md">
          <Radio className="size-3" aria-hidden /> TxLINE fixture #{fixtureId} · commentary refreshes live
        </p>
      </div>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function CommentaryCardView({ card, timestamp, signature, onPlayTTS }: { card: CommentaryCard, timestamp?: number, signature?: string | null, onPlayTTS?: () => void }) {
  return (
    <article className="rounded-2xl border border-proof/20 bg-ink-2 p-5 relative overflow-hidden group">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold leading-snug text-text">{card.headline}</h3>
        {onPlayTTS && (
          <button 
            onClick={onPlayTTS}
            className="shrink-0 size-8 rounded-full bg-proof/10 text-proof flex items-center justify-center hover:bg-proof/20 transition-colors"
            title="Listen to Commentary"
          >
            <Play className="size-4 ml-0.5" />
          </button>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text-dim">{card.analysis}</p>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-ink px-3 py-2.5">
        <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-signal" aria-hidden />
        <p className="text-xs leading-relaxed text-text-dim">{card.market}</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <SourceChip source={card.source} />
        {signature ? (
          <a
            href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[9px] text-proof flex items-center gap-1 hover:underline group"
            title="This prediction is publicly verifiable"
          >
            <span className="group-hover:hidden">Verified prediction ✓</span>
            <span className="hidden group-hover:inline">View proof ↗</span>
          </a>
        ) : timestamp ? (
          <span className="font-mono text-[9px] text-text-dim/70 flex items-center gap-1">
            <span className="size-1 bg-proof/40 rounded-full inline-block"></span> Saved {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="font-mono text-[9px] text-text-dim/70">
            Saving prediction…
          </span>
        )}
      </div>
    </article>
  );
}

function ScoreSide({ name, goals, alignRight }: { name: string; goals?: number; alignRight?: boolean }) {
  return (
    <div className={`min-w-0 flex-1 ${alignRight ? "text-right" : ""}`}>
      <p className="truncate font-mono text-[10px] uppercase tracking-wider text-text-dim">{name}</p>
      <p className="font-mono text-3xl font-bold tabular-nums text-text">{goals ?? "–"}</p>
    </div>
  );
}

function SourceChip({ source }: { source: CommentaryCard["source"] }) {
  return source === "ace" ? (
    <span className="rounded-full border border-proof/30 bg-proof/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-proof">
      ACEDATACLOUD
    </span>
  ) : (
    <span className="rounded-full border border-line bg-ink-3 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-dim">
      model preview
    </span>
  );
}

function CardSkeleton() {
  return <div className="mt-2 h-40 animate-pulse rounded-2xl border border-line bg-ink-2" />;
}
