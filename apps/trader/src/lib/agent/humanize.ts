// Turns the technical StrategySpec into plain English a non-trader understands —
// the trader's equivalent of WHISTL's bet-statement humanizer.
//   "prob_below 45"  →  "the home team is an underdog (under 45% chance to win)"
//   "back HOME @ 2.42" →  "Bet on Home · pays 2.42×"

import type { Selection, Side, StrategySpec } from "./strategy";

export function selectionLabel(sel: Selection): string {
  return sel === "home" ? "the home team" : sel === "away" ? "the away team" : "the draw";
}

export function selectionShort(sel: Selection): string {
  return sel === "home" ? "Home" : sel === "away" ? "Away" : "Draw";
}

export function sideVerb(side: Side): string {
  return side === "back" ? "Bet on" : "Bet against";
}

export function oddsLabel(dec: number): string {
  return `${dec.toFixed(2)}×`;
}

/** Plain-English "when to enter" sentence. */
export function conditionText(spec: StrategySpec): string {
  const t = spec.trigger;
  const who = selectionLabel(spec.selection);
  switch (t.type) {
    case "always":
      return "any match kicks off";
    case "prob_below":
      return `${who} is an underdog — under ${t.value}% chance to win`;
    case "prob_above":
      return `${who} is the favourite — over ${t.value}% chance to win`;
    case "odds_drop":
      return `${who}'s chance jumps ${t.value}%+ within ${t.windowMin} min — money is flowing in`;
    case "odds_rise":
      return `${who}'s chance slides ${t.value}%+ within ${t.windowMin} min — the market is cooling off`;
    default:
      return "—";
  }
}

/** Plain-English "what to do". */
export function actionText(spec: StrategySpec): string {
  return `${sideVerb(spec.side)} ${selectionLabel(spec.selection)}`;
}
