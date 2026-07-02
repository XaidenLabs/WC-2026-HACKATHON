// ORA's pricing brain. Given pact terms + optional live market context, estimate
// P(the predicate resolves TRUE) and produce a transparent honest rationale.
//
// Priority: TxLINE market Pct[] (demargined sharp-book consensus) > Poisson base-rate.
// ORA always discloses which source it used.

export type PactTerms = {
  threshold: number;
  comparison: number; // 0 = ">", 1 = "<", 2 = "="
  statAKey: number;
  statAPeriod: number;
  hasStatB: boolean;
  statBKey: number;
  statBPeriod: number;
  op: number | null; // 0 = add (total), 1 = subtract (margin)
};

// Parsed market context from TxLINE odds (use parse1X2/parseOU from types.ts before calling).
export type MarketContext = {
  x12?: {
    home: { pct: number | null };
    draw: { pct: number | null };
    away: { pct: number | null };
  };
  ou?: {
    line: string;
    over: { pct: number | null };
    under: { pct: number | null };
  };
};

export type OraQuote = {
  probabilityTrue: number; // 0..1
  source: "model" | "market";
  confidence: "low" | "medium" | "high";
  reasoning: string;
  stance: string;
};

// Expected count (λ) per full match, by stat kind (rough World Cup base rates).
function lambdaFor(statKey: number): number {
  if (statKey === 1 || statKey === 2) return 1.3;  // goals / team
  if (statKey === 3 || statKey === 4) return 1.95; // yellow cards / team
  if (statKey === 5 || statKey === 6) return 0.12; // red cards / team
  if (statKey === 7 || statKey === 8) return 5.1;  // corners / team
  return 1.0;
}

const factorial = (n: number) => {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};
const poisson = (k: number, lambda: number) =>
  k < 0 ? 0 : (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);

function tailProb(comparison: number, threshold: number, pmf: (k: number) => number): number {
  const CAP = 60;
  let p = 0;
  for (let k = 0; k <= CAP; k++) {
    if (comparison === 0 && k > threshold) p += pmf(k);       // >
    else if (comparison === 1 && k < threshold) p += pmf(k);  // <
    else if (comparison === 2 && k === threshold) p += pmf(k); // =
  }
  return p;
}

function skellamProb(comparison: number, threshold: number, lamA: number, lamB: number): number {
  const CAP = 40;
  const dist = new Map<number, number>();
  for (let a = 0; a <= CAP; a++) {
    const pa = poisson(a, lamA);
    for (let b = 0; b <= CAP; b++) {
      const d = a - b;
      dist.set(d, (dist.get(d) ?? 0) + pa * poisson(b, lamB));
    }
  }
  let p = 0;
  for (const [d, prob] of dist) {
    if (comparison === 0 && d > threshold) p += prob;
    else if (comparison === 1 && d < threshold) p += prob;
    else if (comparison === 2 && d === threshold) p += prob;
  }
  return p;
}

/** Return a probability from TxLINE market context if the terms map to a known market. */
function tryMarketProb(terms: PactTerms, ctx: MarketContext): number | null {
  const { x12, ou } = ctx;

  // Goal margin > 0 (P1 wins): statA=1, statB=2, op=subtract, comparison=>0, threshold=0
  if (
    x12 &&
    terms.hasStatB &&
    terms.op === 1 &&
    terms.statAKey === 1 &&
    terms.statBKey === 2 &&
    terms.comparison === 0 &&
    terms.threshold === 0 &&
    x12.home.pct != null
  ) {
    return x12.home.pct / 100;
  }

  // Goal margin > 0 (P2 wins): statA=2, statB=1, op=subtract, comparison=>0, threshold=0
  if (
    x12 &&
    terms.hasStatB &&
    terms.op === 1 &&
    terms.statAKey === 2 &&
    terms.statBKey === 1 &&
    terms.comparison === 0 &&
    terms.threshold === 0 &&
    x12.away.pct != null
  ) {
    return x12.away.pct / 100;
  }

  // Draw: goal margin = 0
  if (
    x12 &&
    terms.hasStatB &&
    terms.op === 1 &&
    (terms.statAKey === 1 || terms.statAKey === 2) &&
    (terms.statBKey === 1 || terms.statBKey === 2) &&
    terms.comparison === 2 &&
    terms.threshold === 0 &&
    x12.draw.pct != null
  ) {
    return x12.draw.pct / 100;
  }

  // O/U total goals: statA=1 statB=2 op=add
  if (
    ou &&
    terms.hasStatB &&
    terms.op === 0 &&
    terms.statAKey === 1 &&
    terms.statBKey === 2
  ) {
    const ouLine = parseFloat(ou.line);
    // Over: comparison=0 (>), threshold = floor(line)
    if (terms.comparison === 0 && terms.threshold === Math.floor(ouLine) && ou.over.pct != null) {
      return ou.over.pct / 100;
    }
    // Under: comparison=1 (<), threshold = ceil(line)
    if (terms.comparison === 1 && terms.threshold === Math.ceil(ouLine) && ou.under.pct != null) {
      return ou.under.pct / 100;
    }
  }

  return null;
}

export function priceQuote(terms: PactTerms, marketCtx: MarketContext = {}): OraQuote {
  // Try to price from live market data first
  const mktProb = tryMarketProb(terms, marketCtx);
  if (mktProb != null) {
    const prob = Math.min(0.99, Math.max(0.01, mktProb));
    const pct = (prob * 100).toFixed(1);
    const stance =
      prob < 0.45
        ? `ORA takes the other side — TxLINE sharp-book consensus gives you only ${pct}%.`
        : prob > 0.55
          ? `ORA is cautious — TxLINE gives you ${pct}%, so expect this to happen most of the time.`
          : `Near-coin-flip — TxLINE consensus at ${pct}%.`;
    return {
      probabilityTrue: prob,
      source: "market",
      confidence: "high",
      reasoning: `TxLINE demargined probability: ${pct}%. Priced from sharp-book consensus anchored on Solana — this is the same data that settles the pact on-chain.`,
      stance,
    };
  }

  // Fallback: Poisson / Skellam model
  let p: number;
  let lamNote: string;

  if (!terms.hasStatB) {
    const l = lambdaFor(terms.statAKey);
    p = tailProb(terms.comparison, terms.threshold, (k) => poisson(k, l));
    lamNote = `avg ~${l.toFixed(2)}/match`;
  } else if (terms.op === 0) {
    const l = lambdaFor(terms.statAKey) + lambdaFor(terms.statBKey);
    p = tailProb(terms.comparison, terms.threshold, (k) => poisson(k, l));
    lamNote = `avg ~${l.toFixed(2)}/match`;
  } else {
    const lamA = lambdaFor(terms.statAKey);
    const lamB = lambdaFor(terms.statBKey);
    p = skellamProb(terms.comparison, terms.threshold, lamA, lamB);
    lamNote = `avg ~${lamA.toFixed(2)} vs ~${lamB.toFixed(2)}/team`;
  }

  const prob = Math.min(0.99, Math.max(0.01, p));
  const pct = (prob * 100).toFixed(1);
  const stance =
    prob < 0.45
      ? `ORA will take the other side — model gives you only ${pct}%.`
      : prob > 0.55
        ? `ORA is wary here — model gives you ${pct}%, so it prices the counter accordingly.`
        : `Close call — ORA reads it as near-coin-flip at ${pct}%.`;

  return {
    probabilityTrue: prob,
    source: "model",
    confidence: "medium",
    reasoning: `Poisson base-rate model (${lamNote}) → P(resolves TRUE) ~ ${pct}%. No TxLINE live market for this stat — ORA modeled it from World Cup base rates.`,
    stance,
  };
}
