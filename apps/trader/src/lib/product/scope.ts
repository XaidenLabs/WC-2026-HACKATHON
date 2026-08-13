/**
 * D002 market scope.
 *
 * TXAgent launches football-first through the ORA engine. Other sports stay outside the product until the
 * football product has demonstrated commercial traction and the founder makes
 * an explicit expansion decision.
 */
export const MARKET_SCOPE = {
  sport: "football",
  displayName: "Football",
  feed: "Sportmonks football feed",
  expansionState: "locked",
} as const;

const UNSUPPORTED_SPORTS = [
  "american football",
  "basketball",
  "baseball",
  "boxing",
  "cricket",
  "esports",
  "hockey",
  "mma",
  "nfl",
  "rugby",
  "tennis",
] as const;

export function findUnsupportedSport(text: string): string | null {
  const normalized = text.toLowerCase();
  return UNSUPPORTED_SPORTS.find((sport) => {
    const escaped = sport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
  }) ?? null;
}

export function isFootballScope(value: string | null): boolean {
  return value == null || ["football", "soccer"].includes(value.trim().toLowerCase());
}
