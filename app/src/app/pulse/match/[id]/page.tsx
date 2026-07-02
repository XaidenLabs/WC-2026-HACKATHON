"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Sparkles, RefreshCw, Loader2, TrendingUp, Radio } from "lucide-react";
import type { TxFixture } from "@/lib/txline/types";
import type { CommentaryCard } from "@/lib/pulse/commentary";

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
  const { data: commentariesData, mutate: mutateCommentaries } = useSWR<{ ok: boolean; commentaries: (CommentaryCard & { timestamp: number })[] }>(
    Number.isFinite(fixtureId) ? `/api/pulse/commentaries?fixtureId=${fixtureId}` : null,
    fetcher,
    { refreshInterval: 15000 } // Poll for updates every 15s
  );

  const [resp, setResp] = useState<CommentaryResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ranOnce = useRef(false);

  const generate = useCallback(async () => {
    setLoading(true);
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
        // Refresh the on-chain feed after a short delay since it takes a few seconds to land
        setTimeout(() => mutateCommentaries(), 3000);
      }
      else setError(j.error ?? "Failed to generate commentary");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fixtureId, fixture, mutateCommentaries]);

  // Generate once on mount.
  useEffect(() => {
    if (ranOnce.current || !Number.isFinite(fixtureId)) return;
    ranOnce.current = true;
    generate();
  }, [fixtureId, generate]);

  const p1 = resp?.p1 ?? fixture?.Participant1 ?? "Home";
  const p2 = resp?.p2 ?? fixture?.Participant2 ?? "Away";
  const competition = resp?.competition ?? fixture?.Competition;
  const score = resp?.score;
  const card = resp?.card;

  return (
    <div className="px-4 py-5">
      <Link
        href="/pulse"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Feed
      </Link>

      {/* Header */}
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
        {competition ?? "World Cup"}
      </p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-text">
        {p1} <span className="text-text-dim">v</span> {p2}
      </h1>

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
            <span className="font-mono text-xs text-text-dim">—</span>
          )}
        </div>
        <ScoreSide name={p2} goals={score?.p2Goals} alignRight />
      </div>

      {score && (score.p1Corners > 0 || score.p2Corners > 0) && (
        <p className="mt-2 text-center font-mono text-[10px] text-text-dim">
          Corners {score.p1Corners}–{score.p2Corners}
        </p>
      )}

      {/* AI pundit card */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-text-dim">
          <Sparkles className="size-3.5 text-proof" aria-hidden /> ORA on the mic
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

      {loading && !card && <CardSkeleton />}
      {error && (
        <p className="mt-2 rounded-xl border border-live/30 bg-live/5 p-4 text-sm text-live">
          {error === "TXLINE_TOKEN_MISSING" ? "Live data warming up — try again shortly." : error}
        </p>
      )}

      <div className="mt-2 space-y-3 pb-24">
        {card && (!commentariesData?.commentaries?.length) && (
          <CommentaryCardView card={card} />
        )}
        
        {commentariesData?.commentaries?.map((c, i) => (
          <CommentaryCardView key={i} card={c} timestamp={c.timestamp} />
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-ink via-ink to-transparent pt-12 pb-6 px-4 pointer-events-none flex justify-center">
        <p className="flex items-center gap-1.5 font-mono text-[10px] text-text-dim/80 pointer-events-auto bg-ink/80 px-3 py-1.5 rounded-full border border-line/50 backdrop-blur-md">
          <Radio className="size-3" aria-hidden /> Commentary from live TxLINE data · refreshes on demand
        </p>
      </div>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function CommentaryCardView({ card, timestamp }: { card: CommentaryCard, timestamp?: number }) {
  return (
    <article className="rounded-2xl border border-proof/20 bg-ink-2 p-5">
      <h3 className="text-base font-semibold leading-snug text-text">{card.headline}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-dim">{card.analysis}</p>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-ink px-3 py-2.5">
        <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-signal" aria-hidden />
        <p className="text-xs leading-relaxed text-text-dim">{card.market}</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <SourceChip source={card.source} />
        {timestamp ? (
          <span className="font-mono text-[9px] text-text-dim/70 flex items-center gap-1">
             on-chain memory <span className="size-1 bg-proof/50 rounded-full inline-block"></span> {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="font-mono text-[9px] text-text-dim/70">
            on-chain memory · saving...
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
      ACE · gpt-4o-mini
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
