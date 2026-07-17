import { NextResponse } from "next/server";
import { aceChat, aceConfigured, extractJson } from "@/lib/ace/client";
import type { Selection, Side, StrategySpec, TriggerType } from "@/lib/agent/strategy";

// POST /api/agent/compile  { text }  →  { spec, source }
// Turns a plain-English trading idea into an executable StrategySpec.

const SELECTIONS: Selection[] = ["home", "draw", "away"];
const SIDES: Side[] = ["back", "lay"];
const TRIGGERS: TriggerType[] = ["prob_below", "prob_above", "odds_drop", "odds_rise", "always"];

const SYSTEM = `You compile plain-English sports-betting ideas into a strict JSON strategy for a 1X2 (match winner) market.
Return ONLY JSON:
{
 "name": string (short, 2-4 words),
 "selection": "home" | "draw" | "away",
 "side": "back" | "lay",
 "trigger": { "type": "prob_below"|"prob_above"|"odds_drop"|"odds_rise"|"always", "value": number, "windowMin": number },
 "stake": number,
 "summary": string (one clear sentence)
}
Rules:
- "underdog" → selection with LOW implied probability → trigger prob_below (value ~35).
- "favourite" → prob_above (value ~60).
- "odds shorten / money coming in / backed" → odds_drop (value = pp move, default 8, windowMin default 30).
- "odds drift / lengthen / market cooling" → odds_rise (value pp, default 8).
- value is a number only (percent or percentage-points, no % sign). stake default 100.
- If no team side is clear, use "home".`;

function coerce(obj: Record<string, unknown>): StrategySpec | null {
  if (!obj || typeof obj !== "object") return null;
  const selection = SELECTIONS.includes(obj.selection as Selection) ? (obj.selection as Selection) : "home";
  const side = SIDES.includes(obj.side as Side) ? (obj.side as Side) : "back";
  const tRaw = (obj.trigger ?? {}) as Record<string, unknown>;
  const type = TRIGGERS.includes(tRaw.type as TriggerType) ? (tRaw.type as TriggerType) : "always";
  const value = Number(tRaw.value);
  const windowMin = Number(tRaw.windowMin);
  const stake = Number(obj.stake);
  return {
    name: String(obj.name ?? "Custom strategy").slice(0, 40),
    market: "1X2",
    selection,
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
    const spec = parsed && coerce(parsed);
    if (!spec) return NextResponse.json({ ok: false, error: "ORA returned an invalid strategy" }, { status: 502 });
    return NextResponse.json({ ok: true, spec, source: "ace" });
  } catch (e) {
    console.error("[compile] ACE error:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "ORA_BRAIN_UNAVAILABLE" }, { status: 502 });
  }
}
