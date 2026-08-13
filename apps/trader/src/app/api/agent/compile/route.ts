import { NextResponse } from "next/server";
import { aceChat, aceConfigured, extractJson } from "@/lib/ace/client";
import type { MarketSelection, Selection, Side, StrategyMarket, StrategySpec, TriggerType } from "@/lib/agent/strategy";
import { findUnsupportedSport } from "@/lib/product/scope";

// POST /api/agent/compile  { text }  →  { spec, source }
// Turns a plain-English trading idea into an executable StrategySpec.

const SELECTIONS: Selection[] = ["home", "draw", "away"];
const SIDES: Side[] = ["back", "lay"];
const TRIGGERS: TriggerType[] = ["prob_below", "prob_above", "odds_drop", "odds_rise", "always"];
const MARKETS: StrategyMarket[] = ["1X2", "GOALS", "BTTS"];
const MARKET_SELECTIONS: MarketSelection[] = ["over", "under", "yes", "no"];
const GOAL_LINES = [1.5, 2.5, 3.5, 4.5] as const;

const SYSTEM = `You are ORA, a football strategy assistant. Compile a fan's plain-English rule into strict JSON.
Supported markets are match result, total goals, and both teams to score.
Return ONLY JSON:
{
 "name": string (short, 2-4 words),
 "market": "1X2" | "GOALS" | "BTTS",
 "selection": "home" | "draw" | "away",
 "marketSelection": "over" | "under" | "yes" | "no" | null,
 "line": 1.5 | 2.5 | 3.5 | 4.5 | null,
 "side": "back" | "lay",
 "trigger": { "type": "prob_below"|"prob_above"|"odds_drop"|"odds_rise"|"always", "value": number, "windowMin": number },
 "stake": number,
 "summary": string (one clear sentence)
}
Rules:
- For match result, use market 1X2 and selection home, draw, or away.
- For total goals, use market GOALS, marketSelection over or under, and the requested line.
- For both teams to score, use market BTTS, marketSelection yes or no, and line null.
- "underdog" → selection with LOW implied probability → trigger prob_below (value ~35).
- "favourite" → prob_above (value ~60).
- "odds shorten / money coming in / backed" → odds_drop (value = pp move, default 8, windowMin default 30).
- "odds drift / lengthen / market cooling" → odds_rise (value pp, default 8).
- value is a number only (percent or percentage-points, no % sign). stake default 100.
- If no trigger is stated, use always.
- If no team side is relevant, use home as the compatibility selection.
- Never convert corners, cards, player props, double chance, draw no bet, or team goals into another market. Return an object with an "unsupported" string instead.`;

function coerce(obj: Record<string, unknown>): StrategySpec | null {
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.unsupported === "string") return null;
  const market = MARKETS.includes(obj.market as StrategyMarket) ? (obj.market as StrategyMarket) : "1X2";
  const selection = SELECTIONS.includes(obj.selection as Selection) ? (obj.selection as Selection) : "home";
  const side = SIDES.includes(obj.side as Side) ? (obj.side as Side) : "back";
  const tRaw = (obj.trigger ?? {}) as Record<string, unknown>;
  const type = TRIGGERS.includes(tRaw.type as TriggerType) ? (tRaw.type as TriggerType) : "always";
  const value = Number(tRaw.value);
  const windowMin = Number(tRaw.windowMin);
  const stake = Number(obj.stake);
  const requestedMarketSelection = MARKET_SELECTIONS.includes(obj.marketSelection as MarketSelection)
    ? (obj.marketSelection as MarketSelection)
    : undefined;
  const marketSelection = market === "GOALS"
    ? (requestedMarketSelection === "under" ? "under" : "over")
    : market === "BTTS"
      ? (requestedMarketSelection === "no" ? "no" : "yes")
      : undefined;
  const requestedLine = Number(obj.line);
  const line = market === "GOALS"
    ? (GOAL_LINES.includes(requestedLine as (typeof GOAL_LINES)[number]) ? requestedLine : 2.5) as StrategySpec["line"]
    : undefined;
  return {
    name: String(obj.name ?? "Custom strategy").slice(0, 40),
    market,
    selection,
    marketSelection,
    line,
    side,
    trigger: {
      type,
      value: Number.isFinite(value) ? value : type.startsWith("prob") ? 40 : 8,
      windowMin: Number.isFinite(windowMin) ? windowMin : 30,
    },
    stake: Number.isFinite(stake) && stake > 0 ? stake : 100,
    summary: String(obj.summary ?? "").slice(0, 200),
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = String(body?.text ?? "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "Describe a strategy first" }, { status: 400 });

  const unsupportedSport = findUnsupportedSport(text);
  if (unsupportedSport) {
    return NextResponse.json(
      {
        ok: false,
        error: "FOOTBALL_ONLY",
        message: `ORA currently supports football only. ${unsupportedSport} remains outside the launch scope.`,
      },
      { status: 400 },
    );
  }

  if (!aceConfigured()) {
    return NextResponse.json({ ok: false, error: "ORA_BRAIN_UNAVAILABLE" }, { status: 503 });
  }
  try {
    const reply = await aceChat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
      { maxTokens: 300, temperature: 0.2 },
    );
    const parsed = extractJson<Record<string, unknown>>(reply);
    if (parsed && typeof parsed.unsupported === "string") {
      return NextResponse.json({
        ok: false,
        error: "MARKET_NOT_READY",
        message: `I understand that rule, but this market is not ready for safe automation yet. Try Match Result, Goal Totals, or Both Teams to Score. Requested market: ${String(parsed.unsupported).slice(0, 80)}.`,
      }, { status: 422 });
    }
    const spec = parsed && coerce(parsed);
    if (!spec) return NextResponse.json({ ok: false, error: "ORA could not turn that into a safe football rule" }, { status: 502 });
    return NextResponse.json({ ok: true, spec, source: "ace" });
  } catch (e) {
    console.error("[compile] ACE error:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "ORA_BRAIN_UNAVAILABLE" }, { status: 502 });
  }
}
