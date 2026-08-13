import "server-only";
import { aceChat, aceConfigured, extractJson } from "@/lib/ace/client";
import type { OraForecast, OraOpportunity } from "./engine-domain";
import type { SportmonksFixtureContext } from "@/lib/sportmonks/server";

export type OraCoachAnalysis = {
  source: "llm" | "deterministic_fallback";
  summary: string;
  supportingFactors: string[];
  riskFactors: string[];
  limitations: string[];
};

const cache = new Map<string, { expiresAt: number; value: OraCoachAnalysis }>();

function cleanList(value: unknown, max = 4): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 240))
    .filter(Boolean)
    .slice(0, max);
}

function fallback(forecast: OraForecast, trade: OraOpportunity | null, context: SportmonksFixtureContext): OraCoachAnalysis {
  return {
    source: "deterministic_fallback",
    summary: `${forecast.selectionLabel} is the strongest available model forecast at ${forecast.probabilityPct}%. ${trade ? `${trade.selectionLabel} separately clears ORA's price and risk gates.` : "No available price currently clears ORA's trade gates."}`,
    supportingFactors: [
      `${forecast.marketLabel} is the highest-probability supported outcome in the current model set.`,
      context.recentFixtures.length ? `${context.recentFixtures.length} recent fixture records are available for contextual review.` : "The numerical forecast remains available without a recent-fixture explanation.",
    ],
    riskFactors: [
      `Model quality is ${forecast.quality.predictability}; a probability is not a guarantee.`,
      ...(context.sidelined.length ? [`${context.sidelined.length} sidelined-player record(s) may affect the match.`] : []),
    ],
    limitations: [...context.limitations, "No claims about player mentality are made because mentality is not a verified data field."],
  };
}

export async function coachForecast(
  forecast: OraForecast,
  trade: OraOpportunity | null,
  context: SportmonksFixtureContext,
): Promise<OraCoachAnalysis> {
  const key = JSON.stringify({
    fixtureId: forecast.fixtureId,
    forecast: [forecast.market, forecast.line, forecast.selection, forecast.probabilityPct],
    trade: trade ? [trade.market, trade.line, trade.pick.selection, trade.pick.evPct, trade.pick.dec] : null,
    sidelined: context.sidelined,
    recent: context.recentFixtures.slice(0, 10),
    h2h: context.headToHead.slice(0, 5),
  });
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const safeFallback = fallback(forecast, trade, context);
  if (!aceConfigured()) return safeFallback;

  try {
    const raw = await aceChat([
      {
        role: "system",
        content: [
          "You are ORA's evidence coach for a football forecasting product.",
          "Return one JSON object with keys summary, supportingFactors, riskFactors, limitations.",
          "Use only the supplied evidence. Do not invent injuries, lineups, xG, motivation, mentality, news, or historical results.",
          "Do not change the selected forecast, probability, price, expected value, or trade qualification.",
          "Never promise a win. Clearly distinguish a forecast from a qualified trade.",
          "Keep the summary below 45 words and each list to at most four concise items.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({ forecast, qualifiedTrade: trade, context }),
      },
    ], { temperature: 0.1, maxTokens: 550 });
    const parsed = extractJson<Record<string, unknown>>(raw);
    const summary = typeof parsed?.summary === "string" ? parsed.summary.trim().slice(0, 360) : "";
    if (!summary) return safeFallback;
    const value: OraCoachAnalysis = {
      source: "llm",
      summary,
      supportingFactors: cleanList(parsed?.supportingFactors),
      riskFactors: cleanList(parsed?.riskFactors),
      limitations: [...cleanList(parsed?.limitations), ...context.limitations].filter((item, index, rows) => rows.indexOf(item) === index).slice(0, 5),
    };
    cache.set(key, { expiresAt: Date.now() + 10 * 60_000, value });
    return value;
  } catch {
    return safeFallback;
  }
}
