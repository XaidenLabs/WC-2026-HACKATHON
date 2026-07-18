// ORA's public, deterministic mandate. These constraints are deliberately
// simple enough for a judge to audit and strict enough to make "no trade" a
// first-class decision instead of an afterthought.
export const RISK_MANDATE = {
  minEvPct: 4,
  maxCallsPerCycle: 1,
  maxCallsPerDay: 3,
  fixedReferenceStake: 50,
} as const;

export function riskDecision(input: { evPct: number; callsToday: number; callsThisCycle: number }) {
  if (input.callsToday >= RISK_MANDATE.maxCallsPerDay) return { allowed: false, reason: "daily call limit reached" };
  if (input.callsThisCycle >= RISK_MANDATE.maxCallsPerCycle) return { allowed: false, reason: "cycle exposure limit reached" };
  if (input.evPct < RISK_MANDATE.minEvPct) return { allowed: false, reason: `edge ${input.evPct.toFixed(1)}% is below the ${RISK_MANDATE.minEvPct}% mandate` };
  return { allowed: true as const, reason: "risk mandate satisfied" };
}
