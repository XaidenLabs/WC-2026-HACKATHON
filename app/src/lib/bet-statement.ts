// Turns a bet's raw predicate terms into plain English a non-bettor can read.
//   "Canada goals − South Africa goals > 0"  →  "Canada to win"
//   "(Colombia goals + Portugal goals) < 2"  →  "Under 1.5 goals"
// Used by the bet creator (slip + saved statement) and the bets list (cards),
// so old pacts with a dev-string statement also render cleanly — we derive the
// phrasing from `terms`, not from whatever string was saved.

export type StatementTerms = {
  statAKey: number;
  statBKey?: number;
  hasStatB?: boolean;
  comparison?: number; // 0 = greater, 1 = less, 2 = equal
  threshold?: number;
  op?: number | null; // 0 = add (combined total), 1 = subtract (margin)
};

// Stat keys: odd = home/Participant1, even = away/Participant2.
const teamOf = (key: number, p1: string, p2: string) => (key % 2 === 1 ? p1 : p2);

const nounOf = (key: number) =>
  key === 7 || key === 8 ? "corners" :
  key === 3 || key === 4 ? "yellow cards" :
  key === 5 || key === 6 ? "red cards" :
  "goals";

export function humanStatement(
  terms: StatementTerms | null | undefined,
  p1 = "Home",
  p2 = "Away",
): string {
  if (!terms || terms.comparison == null) return "—";
  const { statAKey, statBKey, hasStatB, comparison, threshold = 0, op } = terms;
  const noun = nounOf(statAKey);

  // ── Two-team markets ──────────────────────────────────────────────────────
  if (hasStatB && statBKey != null) {
    // Margin between the two teams → win / draw / lead.
    if (op === 1) {
      if (comparison === 2) return "Match ends in a draw";
      if (noun === "goals") {
        // statA − statB > 0 ⇒ team A wins;  < 0 ⇒ team B wins.
        return comparison === 0
          ? `${teamOf(statAKey, p1, p2)} to win`
          : `${teamOf(statBKey, p1, p2)} to win`;
      }
      // Corners / cards margin, e.g. "lead by 2+".
      return `${teamOf(statAKey, p1, p2)} to lead ${noun} by ${threshold + 1}+`;
    }
    // Combined total of both teams → over / under (lines are .5 by convention).
    if (op === 0) {
      if (comparison === 0) return `Over ${threshold + 0.5} ${noun}`;
      if (comparison === 1) return `Under ${threshold - 0.5} ${noun}`;
      return `Exactly ${threshold} ${noun}`;
    }
  }

  // ── Single-team market ────────────────────────────────────────────────────
  const team = teamOf(statAKey, p1, p2);
  if (comparison === 0) return `${team} over ${threshold + 0.5} ${noun}`;
  if (comparison === 1) return `${team} under ${threshold - 0.5} ${noun}`;
  return `${team} exactly ${threshold} ${noun}`;
}

// "Jordan vs Argentina" → ["Jordan", "Argentina"]. Tolerant of casing/spacing.
export function splitMatchLabel(label: string | null | undefined): [string, string] {
  if (!label) return ["Home", "Away"];
  const parts = label.split(/\s+vs\.?\s+/i);
  return [parts[0]?.trim() || "Home", parts[1]?.trim() || "Away"];
}
