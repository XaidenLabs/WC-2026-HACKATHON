import type { Selection, Side, StrategySpec } from "./strategy";

// The on-chain "call" an agent inscribes when its strategy fires. Format is human-readable
// (judges can read it on Solana Explorer) and machine-parseable (the ledger reads it back):
//   TxAGENT | <strategy> | <match> | <SIDE SEL @ odds> | <reasoning> | FX#<fixtureId>
// The trailing FX# lets the ledger settle the call against the real TxLINE result.

export type AgentCall = {
  strategy: string;
  match: string;
  side: Side;
  selection: Selection;
  odds: number;
  reasoning: string;
  fixtureId?: number;
};

const SEL_UP: Record<Selection, string> = { home: "HOME", draw: "DRAW", away: "AWAY" };
const SEL_FROM: Record<string, Selection> = { HOME: "home", DRAW: "draw", AWAY: "away" };

export function formatCall(c: AgentCall): string {
  const base = `TxAGENT | ${c.strategy} | ${c.match} | ${c.side.toUpperCase()} ${SEL_UP[c.selection]} @ ${c.odds.toFixed(2)} | ${c.reasoning}`;
  return c.fixtureId != null ? `${base} | FX#${c.fixtureId}` : base;
}

/** A refusal is as auditable as a trade: ORA publishes why capital stayed idle. */
export function formatPass(input: { match: string; fixtureId: number; reason: string }): string {
  return `TxAGENT PASS | Risk Mandate | ${input.match} | ${input.reason} | FX#${input.fixtureId}`;
}

export function parseCall(raw: string): AgentCall | null {
  const text = raw.replace(/^\[\d+\]\s*/, ""); // strip "[len] " prefix from RPC memo field
  if (!text.startsWith("TxAGENT")) return null;
  const parts = text.split(" | ");
  if (parts.length < 5) return null;

  const bet = parts[3].match(/^(BACK|LAY)\s+(HOME|DRAW|AWAY)\s+@\s+([\d.]+)$/);
  if (!bet) return null;

  // Reasoning is everything after the bet, minus a trailing FX# segment if present.
  let reasoningParts = parts.slice(4);
  let fixtureId: number | undefined;
  const last = reasoningParts[reasoningParts.length - 1];
  const fxm = last?.match(/^FX#(\d+)$/);
  if (fxm) {
    fixtureId = Number(fxm[1]);
    reasoningParts = reasoningParts.slice(0, -1);
  }

  return {
    strategy: parts[1].trim(),
    match: parts[2].trim(),
    side: bet[1].toLowerCase() as Side,
    selection: SEL_FROM[bet[2]],
    odds: Number(bet[3]),
    reasoning: reasoningParts.join(" | ").trim(),
    fixtureId,
  };
}

// Data-driven reasoning inscribed with each call — sharp, specific, uses the real numbers.
export function reasoningFor(
  spec: StrategySpec,
  m: { entryProb: number; probChange: number | null },
): string {
  const pct = Math.round(m.entryProb);
  const move = m.probChange != null ? Math.abs(Math.round(m.probChange)) : null;
  switch (spec.trigger.type) {
    case "prob_below":
      return `Priced as an underdog at ${pct}% · rule sees value, entering.`;
    case "prob_above":
      return `Firm favourite at ${pct}% · backing them to convert.`;
    case "odds_drop":
      return `Win-chance jumped +${move}pp to ${pct}% as money came in · following the smart money.`;
    case "odds_rise":
      return `Chance drifted -${move}pp to ${pct}% · market cooling, fading the move.`;
    default:
      return `Entry signal at ${pct}% implied.`;
  }
}
