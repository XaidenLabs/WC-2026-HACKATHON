// ORA compares an independent model probability with a coherent bookmaker quote.
// It does not invent team strength, home advantage, draw bias, or bookmaker margin.
// Those inputs now come from provider prediction and odds feeds.

export type Sel = "home" | "draw" | "away";
export type MarketLeg = { dec: number; pct: number | null };
type Leg = MarketLeg;
export type Odds1X2 = { home: Leg; draw: Leg; away: Leg } | null;
export type OraModel1X2 = {
  home: number;
  draw: number;
  away: number;
  source: "sportmonks";
  quality: ModelQuality;
} | null;

export type ModelQuality = {
  hitRatio: number | null;
  predictability: "poor" | "medium" | "good" | "high" | "unknown";
  predictivePower: "up" | "down" | "unchanged" | "unknown";
};

const VALUE_BAR = 0.015; // require at least +1.5% EV at the executable bookmaker price
const MAX_DECIMAL_ODDS = 1_000;
const MAX_MODEL_MARKET_GAP_PP: Record<ModelQuality["predictability"], number> = {
  poor: 4,
  medium: 6,
  good: 8,
  high: 10,
  unknown: 4,
};

export type Tier = "strong" | "value" | "slim" | "pass";
export type OraPick = {
  selection: Sel;
  prob: number;        // ORA's model probability (%)
  marketProb: number;  // market's implied probability (%)
  edge: number;        // percentage-point difference (model - market)
  evPct: number;       // expected value as % of stake, net of book margin
  dec: number;         // decimal odds
  value: boolean;      // true = positive expected value, worth backing
  tier: Tier;
  confidence: string;  // short human label
  reasoning: string;   // one-line "why"
};

function tierFor(ev: number): Tier {
  if (ev <= VALUE_BAR) return "pass";
  if (ev >= 0.08) return "strong";
  if (ev >= 0.04) return "value";
  return "slim";
}
function labelFor(t: Tier): string {
  return t === "strong" ? "Strong value" : t === "value" ? "Value edge" : t === "slim" ? "Slim edge" : "No edge";
}

function validLeg(leg: Leg): leg is { dec: number; pct: number } {
  return Number.isFinite(leg.dec)
    && leg.dec > 1
    && leg.dec <= MAX_DECIMAL_ODDS
    && leg.pct != null
    && Number.isFinite(leg.pct)
    && leg.pct > 0
    && leg.pct <= 100;
}

function validProbability(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value < 100;
}

/** ORA's match-winner call from the live 1X2 market. Returns its pick, or a "pass" if no value. */
export function oraPick(o: Odds1X2, modelInput: OraModel1X2): OraPick | null {
  if (!o || !modelInput) return null;
  const legs = [
    { sel: "home" as Sel, pct: o.home.pct, dec: o.home.dec },
    { sel: "draw" as Sel, pct: o.draw.pct, dec: o.draw.dec },
    { sel: "away" as Sel, pct: o.away.pct, dec: o.away.dec },
  ];
  if (legs.some((leg) => !validLeg(leg))) return null;
  const validLegs = legs as Array<{ sel: Sel; dec: number; pct: number }>;
  const total = validLegs.reduce((sum, leg) => sum + leg.pct, 0);
  if (!Number.isFinite(total) || total < 95 || total > 105) return null;

  const fair = validLegs.map((leg) => leg.pct / total);
  const rawModel = [modelInput.home, modelInput.draw, modelInput.away];
  if (rawModel.some((value) => !validProbability(value))) return null;
  const modelTotal = rawModel.reduce((sum, value) => sum + value, 0);
  if (modelTotal < 95 || modelTotal > 105) return null;
  const oraProb = rawModel.map((value) => value / modelTotal);

  // Decimal odds already include the bookmaker's vig. Applying another margin here
  // would double-charge the price and understate expected value.
  const evs = legs.map((leg, index) => oraProb[index] * leg.dec - 1);
  let best = 0;
  for (let i = 1; i < 3; i++) if (evs[i] > evs[best]) best = i;

  const ev = evs[best];
  const gap = Math.max(...oraProb.map((probability, index) => Math.abs(probability - fair[index]))) * 100;
  const qualityLimit = MAX_MODEL_MARKET_GAP_PP[modelInput.quality.predictability];
  const disagreement = gap > qualityLimit;
  const tier = disagreement ? "pass" : tierFor(ev);
  const value = !disagreement && tier !== "pass";
  const modelPct = Math.round(oraProb[best] * 1_000) / 10;
  const marketPct = Math.round(fair[best] * 1_000) / 10;
  const sel = legs[best].sel;

  const reasoning = !value
    ? disagreement
      ? `ORA passed because the model and bookmaker market disagree by ${Math.round(gap * 10) / 10} percentage points, above the ${qualityLimit}-point safety limit for a ${modelInput.quality.predictability} league model.`
      : `ORA rates the strongest outcome at ${modelPct}%, but no available price clears the value threshold.`
    : `ORA rates this outcome at ${modelPct}% versus the market's ${marketPct}%. At ${legs[best].dec.toFixed(2)} decimal odds, the expected value is ${Math.round(ev * 1_000) / 10}%.`;

  return {
    selection: sel,
    prob: modelPct,
    marketProb: marketPct,
    edge: Math.round((modelPct - marketPct) * 10) / 10,
    evPct: Math.round(ev * 1000) / 10,
    dec: Math.round((legs[best].dec as number) * 100) / 100,
    value,
    tier,
    confidence: labelFor(tier),
    reasoning,
  };
}

/** Potential payout on a stake, rounded to cents. */
export function payoutOn(stake: number, dec: number): number {
  return Math.round(stake * dec * 100) / 100;
}

// ─── Goals Over/Under market ────────────────────────────────────────────────
type OuLeg = { dec: number; pct: number | null };
export type OuOdds = { line: string; over: OuLeg; under: OuLeg } | null;
export type OraGoalsModel = {
  line: number;
  over: number;
  under: number;
  source: "sportmonks";
  quality: ModelQuality;
} | null;
export type OraGoalsPick = {
  selection: "over" | "under";
  line: number;
  prob: number;
  marketProb: number;
  edge: number;
  evPct: number;
  dec: number;
  value: boolean;
  tier: Tier;
  confidence: string;
  label: string; // "Over 2.5" / "Under 2.5"
  reasoning: string;
};

export type BttsOdds = { yes: MarketLeg; no: MarketLeg } | null;
export type OraBttsModel = {
  yes: number;
  no: number;
  source: "sportmonks";
  quality: ModelQuality;
} | null;
export type OraBttsPick = {
  selection: "yes" | "no";
  prob: number;
  marketProb: number;
  edge: number;
  evPct: number;
  dec: number;
  value: boolean;
  tier: Tier;
  confidence: string;
  label: string;
  reasoning: string;
};

/** ORA's total-goals call using independent feed probabilities, never a fixed over/under bias. */
export function oraGoalsPick(ou: OuOdds, modelInput: OraGoalsModel): OraGoalsPick | null {
  if (!ou || !modelInput) return null;
  const line = parseFloat(ou.line);
  const o = ou.over, u = ou.under;
  if (!validLeg(o) || !validLeg(u) || !Number.isFinite(line) || line < 0 || line > 20) return null;

  const total = o.pct + u.pct;
  if (!Number.isFinite(total) || total < 95 || total > 105) return null;
  if (Math.abs(modelInput.line - line) > 0.001 || !validProbability(modelInput.over) || !validProbability(modelInput.under)) return null;
  const fOver = o.pct / total;
  const fUnder = u.pct / total;
  const modelTotal = modelInput.over + modelInput.under;
  if (modelTotal < 95 || modelTotal > 105) return null;
  const pOver = modelInput.over / modelTotal;
  const pUnder = modelInput.under / modelTotal;

  const evOver = pOver * o.dec - 1;
  const evUnder = pUnder * u.dec - 1;
  const overWins = evOver >= evUnder;
  const ev = overWins ? evOver : evUnder;
  const sel: "over" | "under" = overWins ? "over" : "under";
  const modelPct = Math.round((overWins ? pOver : pUnder) * 1_000) / 10;
  const marketPct = Math.round((overWins ? fOver : fUnder) * 1_000) / 10;
  const dec = Math.round((overWins ? o.dec : u.dec) * 100) / 100;
  const disagreement = Math.max(Math.abs(pOver - fOver), Math.abs(pUnder - fUnder)) * 100;
  const qualityLimit = MAX_MODEL_MARKET_GAP_PP[modelInput.quality.predictability];
  const unsafeDisagreement = disagreement > qualityLimit;
  const tier = unsafeDisagreement ? "pass" : tierFor(ev);
  const value = !unsafeDisagreement && tier !== "pass";

  const reasoning = !value
    ? unsafeDisagreement
      ? `ORA passed because the goals model and market differ by ${Math.round(disagreement * 10) / 10} percentage points, above the ${qualityLimit}-point safety limit.`
      : `The ${line} goals market does not clear ORA's value threshold, so ORA passes.`
    : `ORA rates ${sel} ${line} at ${modelPct}% versus the market's ${marketPct}%.`;

  return {
    selection: sel,
    line,
    prob: modelPct,
    marketProb: marketPct,
    edge: Math.round((modelPct - marketPct) * 10) / 10,
    evPct: Math.round(ev * 1000) / 10,
    dec,
    value,
    tier,
    confidence: labelFor(tier),
    label: `${sel === "over" ? "Over" : "Under"} ${line}`,
    reasoning,
  };
}

/** ORA's both-teams-to-score call from an independent model and a coherent Yes/No quote. */
export function oraBttsPick(odds: BttsOdds, modelInput: OraBttsModel): OraBttsPick | null {
  if (!odds || !modelInput || !validLeg(odds.yes) || !validLeg(odds.no)) return null;
  if (!validProbability(modelInput.yes) || !validProbability(modelInput.no)) return null;

  const marketTotal = odds.yes.pct + odds.no.pct;
  const modelTotal = modelInput.yes + modelInput.no;
  if (marketTotal < 95 || marketTotal > 105 || modelTotal < 95 || modelTotal > 105) return null;

  const fairYes = odds.yes.pct / marketTotal;
  const fairNo = odds.no.pct / marketTotal;
  const modelYes = modelInput.yes / modelTotal;
  const modelNo = modelInput.no / modelTotal;
  const yesEv = modelYes * odds.yes.dec - 1;
  const noEv = modelNo * odds.no.dec - 1;
  const yesWins = yesEv >= noEv;
  const selection = yesWins ? "yes" : "no";
  const ev = yesWins ? yesEv : noEv;
  const modelProbability = yesWins ? modelYes : modelNo;
  const fairProbability = yesWins ? fairYes : fairNo;
  const decimal = yesWins ? odds.yes.dec : odds.no.dec;
  const disagreement = Math.max(Math.abs(modelYes - fairYes), Math.abs(modelNo - fairNo)) * 100;
  const qualityLimit = MAX_MODEL_MARKET_GAP_PP[modelInput.quality.predictability];
  const unsafeDisagreement = disagreement > qualityLimit;
  const tier = unsafeDisagreement ? "pass" : tierFor(ev);
  const value = !unsafeDisagreement && tier !== "pass";
  const modelPct = Math.round(modelProbability * 1_000) / 10;
  const marketPct = Math.round(fairProbability * 1_000) / 10;

  const reasoning = !value
    ? unsafeDisagreement
      ? `ORA passed because the BTTS model and market differ by ${Math.round(disagreement * 10) / 10} percentage points, above the ${qualityLimit}-point safety limit.`
      : "The BTTS market does not clear ORA's value threshold, so ORA passes."
    : `ORA rates BTTS ${selection} at ${modelPct}% versus the market's ${marketPct}%.`;

  return {
    selection,
    prob: modelPct,
    marketProb: marketPct,
    edge: Math.round((modelPct - marketPct) * 10) / 10,
    evPct: Math.round(ev * 1_000) / 10,
    dec: Math.round(decimal * 100) / 100,
    value,
    tier,
    confidence: labelFor(tier),
    label: `BTTS ${selection === "yes" ? "Yes" : "No"}`,
    reasoning,
  };
}
