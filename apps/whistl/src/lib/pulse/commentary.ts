import "server-only";
import { aceChat, aceConfigured, extractJson, type ChatMessage } from "@/lib/ace/client";

// The AI pundit card shown in the WHISTL Pulse match feed.
export type CommentaryCard = {
  headline: string; // ≤ ~12 words
  analysis: string; // 1–2 sentences
  market: string; // 1 sentence on what the odds imply
  source: "ace" | "template";
};

export type MatchContext = {
  p1: string;
  p2: string;
  competition?: string;
  phase: "live" | "upcoming" | "finished";
  minute?: number;
  p1Goals: number;
  p2Goals: number;
  p1Corners: number;
  p2Corners: number;
  // Demargined 1X2 implied percentages, if available.
  odds?: { homePct: number | null; drawPct: number | null; awayPct: number | null } | null;
};

function scoreline(c: MatchContext) {
  return `${c.p1} ${c.p1Goals}-${c.p2Goals} ${c.p2}`;
}

function buildPrompt(c: MatchContext): ChatMessage[] {
  const oddsLine = c.odds
    ? `Current market (demargined): ${c.p1} win ${fmtPct(c.odds.homePct)}, draw ${fmtPct(
        c.odds.drawPct,
      )}, ${c.p2} win ${fmtPct(c.odds.awayPct)}.`
    : "No live odds available.";

  const state =
    c.phase === "upcoming"
      ? `The match has not kicked off yet.`
      : c.phase === "finished"
        ? `Full time. Final score ${scoreline(c)}.`
        : `Live, ~${c.minute ?? 0}' played. Score ${scoreline(c)}. Corners ${c.p1Corners}-${c.p2Corners}.`;

  return [
    {
      role: "system",
      content:
        "You are a sharp, witty football co-commentator for casual World Cup fans. " +
        "Explain the moment in plain, exciting language — no jargon, no betting slang. " +
        "Reply with ONLY a JSON object: " +
        '{"headline": string (max 12 words), "analysis": string (1-2 sentences), "market": string (1 sentence on what the odds imply for a casual fan)}.',
    },
    {
      role: "user",
      content: `Match: ${c.p1} vs ${c.p2}${c.competition ? ` (${c.competition})` : ""}.
${state}
${oddsLine}
Write the commentary card now as JSON.`,
    },
  ];
}

function fmtPct(p: number | null | undefined) {
  return p == null ? "n/a" : `${Math.round(p)}%`;
}

// Deterministic fallback so the feed always renders — used when ACE is unconfigured or errors.
function templateCard(c: MatchContext): CommentaryCard {
  const lead =
    c.p1Goals === c.p2Goals
      ? "All square"
      : `${c.p1Goals > c.p2Goals ? c.p1 : c.p2} in front`;

  const headline =
    c.phase === "upcoming"
      ? `${c.p1} vs ${c.p2} — about to kick off`
      : c.phase === "finished"
        ? `Full time: ${scoreline(c)}`
        : `${lead} — ${scoreline(c)}`;

  const analysis =
    c.phase === "upcoming"
      ? `Two sides set to go. Keep an eye on the opening exchanges to see who settles first.`
      : `${lead} after ${c.phase === "finished" ? "90" : c.minute ?? 0} minutes, with ${
          c.p1Corners + c.p2Corners
        } corners between them so far.`;

  const fav =
    c.odds && c.odds.homePct != null && c.odds.awayPct != null
      ? c.odds.homePct > c.odds.awayPct
        ? c.p1
        : c.p2
      : null;
  const market = fav
    ? `The market still leans toward ${fav} — but momentum can flip fast.`
    : `No clear favourite right now — this one's wide open.`;

  return { headline, analysis, market, source: "template" };
}

/** Generate a commentary card — real LLM via ACE, falling back to a template on any failure. */
export async function generateCommentary(c: MatchContext): Promise<CommentaryCard> {
  if (!aceConfigured()) return templateCard(c);
  try {
    const reply = await aceChat(buildPrompt(c), { maxTokens: 320, temperature: 0.8 });
    const parsed = extractJson<{ headline?: string; analysis?: string; market?: string }>(reply);
    if (!parsed?.headline || !parsed.analysis) return templateCard(c);
    return {
      headline: parsed.headline,
      analysis: parsed.analysis,
      market: parsed.market ?? templateCard(c).market,
      source: "ace",
    };
  } catch {
    return templateCard(c);
  }
}
