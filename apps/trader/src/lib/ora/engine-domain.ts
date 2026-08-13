import type { MarketFixture, MarketQuote } from "@/lib/market-data/types";
import type { SupervisedMarket, SupervisedSelection } from "@/lib/supervision/domain";
import type { ModelQuality } from "./pick.ts";
import { oraBttsPick, oraGoalsPick, oraPick, type OraBttsPick, type OraGoalsPick, type OraPick } from "./pick.ts";

export type OraMarketPick = (OraPick | OraGoalsPick | OraBttsPick) & {
  selection: SupervisedSelection;
};

export type OraOpportunity = {
  fixtureId: number;
  match: string;
  startTime: number;
  market: SupervisedMarket;
  line: number | null;
  marketLabel: string;
  selectionLabel: string;
  pick: OraMarketPick;
};

export type OraForecast = {
  fixtureId: number;
  match: string;
  startTime: number;
  market: SupervisedMarket;
  line: number | null;
  marketLabel: string;
  selection: SupervisedSelection;
  selectionLabel: string;
  probabilityPct: number;
  quality: ModelQuality;
  executablePrice: number | null;
  status: "forecast_only" | "priced";
  reasoning: string;
};

export function opportunityKey(opportunity: Pick<OraOpportunity, "fixtureId" | "market" | "line" | "pick">): string {
  return `ora:v2:${opportunity.fixtureId}:${opportunity.market}:${opportunity.line ?? "na"}:${opportunity.pick.selection}`;
}

export function opportunitiesFromQuote(fixture: MarketFixture, quote: MarketQuote): OraOpportunity[] {
  const base = {
    fixtureId: fixture.FixtureId,
    match: `${fixture.Participant1} v ${fixture.Participant2}`,
    startTime: fixture.StartTime,
  };
  const opportunities: OraOpportunity[] = [];
  const winner = oraPick(quote.odds, quote.model);
  if (winner) {
    const selectionLabel = winner.selection === "home"
      ? fixture.Participant1
      : winner.selection === "away" ? fixture.Participant2 : "Draw";
    opportunities.push({ ...base, market: "1x2", line: null, marketLabel: "Match winner", selectionLabel, pick: winner });
  }
  for (const goalMarket of quote.goalMarkets) {
    const pick = oraGoalsPick(goalMarket.odds, goalMarket.model);
    if (pick) opportunities.push({
      ...base,
      market: "goals_ou",
      line: pick.line,
      marketLabel: `Total goals ${pick.line}`,
      selectionLabel: pick.label,
      pick,
    });
  }
  const btts = oraBttsPick(quote.btts, quote.bttsModel);
  if (btts) opportunities.push({
    ...base,
    market: "btts",
    line: null,
    marketLabel: "Both teams to score",
    selectionLabel: btts.label,
    pick: btts,
  });
  return opportunities;
}

function roundedProbability(value: number): number {
  return Math.round(value * 10) / 10;
}

function forecastUtility(forecast: OraForecast): number {
  // A useful headline forecast should be confident without always collapsing into
  // a very broad, low-information line such as Under 4.5. The model probability
  // remains untouched; this score only ranks which supported forecast is shown first.
  const targetConfidence = 75;
  const priceBonus = forecast.status === "priced" ? 2 : 0;
  return 100 - Math.abs(forecast.probabilityPct - targetConfidence) + priceBonus;
}

/**
 * Finds the strongest model-backed outcome without pretending it is a profitable trade.
 * This layer can use prediction-only markets. The execution layer remains price-gated.
 */
export function forecastsFromQuote(fixture: MarketFixture, quote: MarketQuote): OraForecast[] {
  const base = {
    fixtureId: fixture.FixtureId,
    match: `${fixture.Participant1} v ${fixture.Participant2}`,
    startTime: fixture.StartTime,
  };
  const forecasts: OraForecast[] = [];

  if (quote.model) {
    const outcomes = [
      { selection: "home" as const, label: fixture.Participant1, probability: quote.model.home, price: quote.odds?.home.dec ?? null },
      { selection: "draw" as const, label: "Draw", probability: quote.model.draw, price: quote.odds?.draw.dec ?? null },
      { selection: "away" as const, label: fixture.Participant2, probability: quote.model.away, price: quote.odds?.away.dec ?? null },
    ];
    const strongest = outcomes.toSorted((a, b) => b.probability - a.probability)[0];
    forecasts.push({
      ...base,
      market: "1x2",
      line: null,
      marketLabel: "Match winner",
      selection: strongest.selection,
      selectionLabel: strongest.label,
      probabilityPct: roundedProbability(strongest.probability),
      quality: quote.model.quality,
      executablePrice: strongest.price,
      status: strongest.price == null ? "forecast_only" : "priced",
      reasoning: `ORA makes ${strongest.label} the most likely 1X2 outcome at ${roundedProbability(strongest.probability)}%.`,
    });
  }

  for (const model of quote.goalModels) {
    const overWins = model.over >= model.under;
    const selection = overWins ? "over" as const : "under" as const;
    const probability = overWins ? model.over : model.under;
    const priced = quote.goalMarkets.find((item) => Math.abs(Number(item.odds.line) - model.line) < 0.001)?.odds ?? null;
    const price = priced ? (overWins ? priced.over.dec : priced.under.dec) : null;
    const label = `${overWins ? "Over" : "Under"} ${model.line}`;
    forecasts.push({
      ...base,
      market: "goals_ou",
      line: model.line,
      marketLabel: `Total goals ${model.line}`,
      selection,
      selectionLabel: label,
      probabilityPct: roundedProbability(probability),
      quality: model.quality,
      executablePrice: price,
      status: price == null ? "forecast_only" : "priced",
      reasoning: `Historical and match-model inputs rate ${label} at ${roundedProbability(probability)}%.${price == null ? " No executable bookmaker price is available for this line yet." : ""}`,
    });
  }

  if (quote.bttsModel) {
    const yesWins = quote.bttsModel.yes >= quote.bttsModel.no;
    const probability = yesWins ? quote.bttsModel.yes : quote.bttsModel.no;
    const price = quote.btts ? (yesWins ? quote.btts.yes.dec : quote.btts.no.dec) : null;
    const label = `BTTS ${yesWins ? "Yes" : "No"}`;
    forecasts.push({
      ...base,
      market: "btts",
      line: null,
      marketLabel: "Both teams to score",
      selection: yesWins ? "yes" : "no",
      selectionLabel: label,
      probabilityPct: roundedProbability(probability),
      quality: quote.bttsModel.quality,
      executablePrice: price,
      status: price == null ? "forecast_only" : "priced",
      reasoning: `ORA rates ${label} at ${roundedProbability(probability)}%.${price == null ? " No executable bookmaker price is available yet." : ""}`,
    });
  }

  return forecasts.toSorted((a, b) => forecastUtility(b) - forecastUtility(a) || b.probabilityPct - a.probabilityPct || a.marketLabel.localeCompare(b.marketLabel));
}

export function rankOpportunities(opportunities: OraOpportunity[]): OraOpportunity[] {
  return opportunities
    .filter((item) => item.pick.value && Number.isFinite(item.pick.evPct))
    .toSorted((a, b) => b.pick.evPct - a.pick.evPct || a.startTime - b.startTime || a.fixtureId - b.fixtureId);
}

export function chooseOpportunity(opportunities: OraOpportunity[], minEvPct: number): OraOpportunity | null {
  return rankOpportunities(opportunities).find((item) => item.pick.evPct >= minEvPct) ?? null;
}
