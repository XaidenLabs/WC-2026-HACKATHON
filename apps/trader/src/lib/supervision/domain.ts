export const APPROVAL_WINDOW_MS = 5 * 60 * 1000;
export const EXECUTION_GRACE_MS = 2 * 60 * 1000;

export type SupervisedMarket = "1x2" | "goals_ou" | "btts";
export type SupervisedSelection = "home" | "draw" | "away" | "over" | "under" | "yes" | "no";

export type ProposalStatus =
  | "pending"
  | "executing"
  | "executed"
  | "declined"
  | "expired"
  | "blocked"
  | "failed";

export type ExecutionTrigger = "user_approval" | "countdown_expiry";

export type TradingMandate = {
  userDid: string;
  autoExecute: boolean;
  paused: boolean;
  killed: boolean;
  maxStake: number;
  maxDailyStake: number;
  minEvPct: number;
  maxOddsDriftPct: number;
  allowedMarkets: SupervisedMarket[];
  updatedAt: string;
};

export type TradeProposal = {
  id: string;
  userDid: string;
  fixtureId: number;
  match: string;
  market: SupervisedMarket;
  line: number | null;
  selection: SupervisedSelection;
  predictedProbabilityPct: number;
  marketProbabilityPct: number;
  evPct: number;
  quotedOdds: number;
  stake: number;
  status: ProposalStatus;
  autoExecuteAuthorized: boolean;
  createdAt: string;
  decisionDeadlineAt: string;
  executionDeadlineAt: string;
  trigger: ExecutionTrigger | null;
  decisionReason: string | null;
  executionRef: string | null;
  version: number;
};

export type FreshExecutionCheck = {
  fixtureId: number;
  market: SupervisedMarket;
  line: number | null;
  selection: SupervisedSelection;
  odds: number;
  evPct: number;
  availableBalance: number;
  committedToday: number;
  simulationOk: boolean;
};

export type ExecutionGate =
  | { allowed: true }
  | { allowed: false; code: string; reason: string };

export type ProposalInput = Pick<
  TradeProposal,
  | "id"
  | "userDid"
  | "fixtureId"
  | "match"
  | "market"
  | "line"
  | "selection"
  | "predictedProbabilityPct"
  | "marketProbabilityPct"
  | "evPct"
  | "quotedOdds"
  | "stake"
>;

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const roundMetric = (value: number) => Math.round(value * 1000) / 1000;

export function defaultMandate(userDid: string, nowMs = Date.now()): TradingMandate {
  return {
    userDid,
    autoExecute: false,
    paused: false,
    killed: false,
    maxStake: 25,
    maxDailyStake: 75,
    minEvPct: 4,
    maxOddsDriftPct: 2,
    allowedMarkets: ["1x2", "goals_ou", "btts"],
    updatedAt: new Date(nowMs).toISOString(),
  };
}

export function validateMandate(mandate: TradingMandate): string[] {
  const errors: string[] = [];
  if (!mandate.userDid) errors.push("A verified user is required");
  if (!(mandate.maxStake > 0 && mandate.maxStake <= 10_000)) errors.push("Maximum stake must be between 0 and 10,000 test USDC");
  if (!(mandate.maxDailyStake >= mandate.maxStake && mandate.maxDailyStake <= 100_000)) errors.push("Daily limit must be at least the maximum stake and no more than 100,000 test USDC");
  if (!(mandate.minEvPct >= 0 && mandate.minEvPct <= 100)) errors.push("Minimum EV must be between 0% and 100%");
  if (!(mandate.maxOddsDriftPct >= 0 && mandate.maxOddsDriftPct <= 25)) errors.push("Maximum odds drift must be between 0% and 25%");
  if (mandate.allowedMarkets.length === 0) errors.push("At least one market must be permitted");
  if (mandate.allowedMarkets.some((market) => !["1x2", "goals_ou", "btts"].includes(market))) errors.push("The mandate contains an unsupported market");
  return errors;
}

export function createTradeProposal(input: ProposalInput, mandate: TradingMandate, nowMs = Date.now()): TradeProposal {
  const mandateErrors = validateMandate(mandate);
  if (mandateErrors.length) throw new Error(mandateErrors.join(". "));
  if (input.userDid !== mandate.userDid) throw new Error("Proposal user does not match the mandate owner");
  if (!(input.stake > 0)) throw new Error("Stake must be positive");
  if (input.stake > mandate.maxStake) throw new Error("Stake exceeds the user mandate");
  if (!(input.quotedOdds > 1)) throw new Error("Quoted odds must be greater than one");
  if (!Number.isFinite(input.evPct)) throw new Error("Expected value must be finite");
  if (!(Number.isFinite(input.predictedProbabilityPct) && input.predictedProbabilityPct > 0 && input.predictedProbabilityPct <= 100)) {
    throw new Error("Predicted probability is invalid");
  }
  if (!(Number.isFinite(input.marketProbabilityPct) && input.marketProbabilityPct > 0 && input.marketProbabilityPct <= 100)) {
    throw new Error("Market probability is invalid");
  }
  if (!mandate.allowedMarkets.includes(input.market)) throw new Error("Market is outside the user mandate");

  return {
    ...input,
    match: input.match.slice(0, 120),
    predictedProbabilityPct: roundMetric(input.predictedProbabilityPct),
    marketProbabilityPct: roundMetric(input.marketProbabilityPct),
    evPct: roundMetric(input.evPct),
    quotedOdds: roundMetric(input.quotedOdds),
    stake: roundMoney(input.stake),
    status: "pending",
    autoExecuteAuthorized: mandate.autoExecute && !mandate.paused && !mandate.killed,
    createdAt: new Date(nowMs).toISOString(),
    decisionDeadlineAt: new Date(nowMs + APPROVAL_WINDOW_MS).toISOString(),
    executionDeadlineAt: new Date(nowMs + APPROVAL_WINDOW_MS + EXECUTION_GRACE_MS).toISOString(),
    trigger: null,
    decisionReason: null,
    executionRef: null,
    version: 1,
  };
}

export function executionGate(
  proposal: TradeProposal,
  mandate: TradingMandate,
  fresh: FreshExecutionCheck,
  trigger: ExecutionTrigger,
  nowMs = Date.now(),
): ExecutionGate {
  if (proposal.status !== "pending") return { allowed: false, code: "NOT_PENDING", reason: "Proposal is no longer pending" };
  if (proposal.userDid !== mandate.userDid) return { allowed: false, code: "WRONG_USER", reason: "Mandate owner mismatch" };
  if (mandate.killed) return { allowed: false, code: "KILL_SWITCH", reason: "The kill switch is active" };
  if (mandate.paused) return { allowed: false, code: "PAUSED", reason: "Automatic execution is paused" };
  if (trigger === "countdown_expiry" && (!mandate.autoExecute || !proposal.autoExecuteAuthorized)) {
    return { allowed: false, code: "NOT_PREAUTHORIZED", reason: "Auto-execution was not authorized when the proposal was created" };
  }

  const decisionDeadline = Date.parse(proposal.decisionDeadlineAt);
  const executionDeadline = Date.parse(proposal.executionDeadlineAt);
  if (trigger === "countdown_expiry" && nowMs < decisionDeadline) return { allowed: false, code: "WINDOW_OPEN", reason: "The five-minute decision window is still open" };
  if (nowMs > executionDeadline) return { allowed: false, code: "STALE_PROPOSAL", reason: "The proposal execution window has expired" };

  if (!mandate.allowedMarkets.includes(proposal.market)) return { allowed: false, code: "MARKET_BLOCKED", reason: "Market is no longer permitted" };
  if (proposal.stake > mandate.maxStake) return { allowed: false, code: "STAKE_LIMIT", reason: "Stake exceeds the mandate maximum" };
  if (fresh.committedToday + proposal.stake > mandate.maxDailyStake) return { allowed: false, code: "DAILY_LIMIT", reason: "Execution would exceed the daily allocation" };
  if (fresh.availableBalance < proposal.stake) return { allowed: false, code: "BALANCE", reason: "Insufficient test USDC balance" };
  if (fresh.evPct < mandate.minEvPct) return { allowed: false, code: "EV_DROPPED", reason: "The fresh expected value is below the mandate minimum" };
  if (!fresh.simulationOk) return { allowed: false, code: "SIMULATION_FAILED", reason: "The transaction simulation did not pass" };

  const sameMarket = fresh.fixtureId === proposal.fixtureId
    && fresh.market === proposal.market
    && fresh.selection === proposal.selection
    && (fresh.line === proposal.line || (fresh.line != null && proposal.line != null && Math.abs(fresh.line - proposal.line) <= 0.001));
  if (!sameMarket) return { allowed: false, code: "MARKET_CHANGED", reason: "The fresh market does not match the authorized proposal" };

  const driftPct = Math.abs(fresh.odds - proposal.quotedOdds) / proposal.quotedOdds * 100;
  if (driftPct > mandate.maxOddsDriftPct) return { allowed: false, code: "ODDS_DRIFT", reason: "The price moved beyond the authorized slippage limit" };
  return { allowed: true };
}

export function beginExecution(
  proposal: TradeProposal,
  mandate: TradingMandate,
  fresh: FreshExecutionCheck,
  trigger: ExecutionTrigger,
  nowMs = Date.now(),
): TradeProposal {
  const gate = executionGate(proposal, mandate, fresh, trigger, nowMs);
  if (!gate.allowed) {
    return {
      ...proposal,
      status: gate.code === "NOT_PREAUTHORIZED" || gate.code === "STALE_PROPOSAL" ? "expired" : "blocked",
      trigger,
      decisionReason: `${gate.code}: ${gate.reason}`,
      version: proposal.version + 1,
    };
  }
  return {
    ...proposal,
    status: "executing",
    trigger,
    decisionReason: trigger === "user_approval" ? "Approved by user" : "Five-minute window elapsed with prior authorization",
    version: proposal.version + 1,
  };
}

export function declineProposal(proposal: TradeProposal, nowMs = Date.now()): TradeProposal {
  if (proposal.status !== "pending") throw new Error("Only a pending proposal can be declined");
  if (nowMs > Date.parse(proposal.executionDeadlineAt)) throw new Error("Proposal has already expired");
  return { ...proposal, status: "declined", decisionReason: "Declined by user", version: proposal.version + 1 };
}

export function changeProposalStake(proposal: TradeProposal, mandate: TradingMandate, stake: number, nowMs = Date.now()): TradeProposal {
  if (proposal.status !== "pending") throw new Error("Only a pending proposal can be changed");
  if (!(stake > 0 && stake <= mandate.maxStake)) throw new Error("Stake is outside the user mandate");
  return {
    ...proposal,
    stake: roundMoney(stake),
    createdAt: new Date(nowMs).toISOString(),
    decisionDeadlineAt: new Date(nowMs + APPROVAL_WINDOW_MS).toISOString(),
    executionDeadlineAt: new Date(nowMs + APPROVAL_WINDOW_MS + EXECUTION_GRACE_MS).toISOString(),
    decisionReason: "Stake changed by user. The five-minute review window restarted.",
    version: proposal.version + 1,
  };
}

export function completeExecution(proposal: TradeProposal, executionRef: string): TradeProposal {
  if (proposal.status !== "executing") throw new Error("Proposal is not ready to complete");
  if (!executionRef) throw new Error("Execution receipt is required");
  return { ...proposal, status: "executed", executionRef, version: proposal.version + 1 };
}

export function failExecution(proposal: TradeProposal, reason: string): TradeProposal {
  if (proposal.status !== "executing") throw new Error("Proposal is not executing");
  return { ...proposal, status: "failed", decisionReason: reason.slice(0, 300), version: proposal.version + 1 };
}
