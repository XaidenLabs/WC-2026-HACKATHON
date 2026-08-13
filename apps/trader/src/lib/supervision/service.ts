import "server-only";
import { balanceOf, getUserBets, placeReplayBet, placeSupervisedBet } from "@/lib/trader/betstore";
import { freshOraQuote, scanOraMarkets } from "@/lib/ora/engine";
import { opportunityKey } from "@/lib/ora/engine-domain";
import {
  beginExecution,
  changeProposalStake,
  completeExecution,
  createTradeProposal,
  declineProposal,
  failExecution,
  validateMandate,
  type ExecutionTrigger,
  type FreshExecutionCheck,
  type TradeProposal,
  type TradingMandate,
} from "./domain";
import {
  committedToday,
  getOrCreateMandate,
  getProposalForUser,
  insertProposal,
  listDueProposals,
  listActiveMandates,
  listProposals,
  newProposalId,
  saveMandate,
  updateProposal,
} from "./store";

export const REPLAY_OPPORTUNITY = {
  fixtureId: 2_026_080_6,
  match: "Arsenal v Liverpool",
  market: "1x2" as const,
  line: null,
  selection: "home" as const,
  predictedProbabilityPct: 51,
  marketProbabilityPct: 45,
  evPct: 6.4,
  quotedOdds: 2.2,
};

export async function readSupervision(userDid: string) {
  const [mandate, proposals] = await Promise.all([
    getOrCreateMandate(userDid),
    listProposals(userDid),
  ]);
  return { mandate, proposals };
}

export async function updateMandate(userDid: string, input: Partial<TradingMandate>) {
  const current = await getOrCreateMandate(userDid);
  if (current.killed && input.killed === false) throw new Error("KILL_SWITCH_IS_TERMINAL");
  const next: TradingMandate = {
    ...current,
    autoExecute: input.autoExecute ?? current.autoExecute,
    paused: input.paused ?? current.paused,
    killed: input.killed ?? current.killed,
    maxStake: input.maxStake ?? current.maxStake,
    maxDailyStake: input.maxDailyStake ?? current.maxDailyStake,
    minEvPct: input.minEvPct ?? current.minEvPct,
    maxOddsDriftPct: input.maxOddsDriftPct ?? current.maxOddsDriftPct,
    allowedMarkets: input.allowedMarkets ?? current.allowedMarkets,
    userDid,
    updatedAt: new Date().toISOString(),
  };
  const errors = validateMandate(next);
  if (errors.length) throw new Error(errors.join(". "));
  if (next.killed) {
    next.autoExecute = false;
    next.paused = true;
  }
  return saveMandate(next);
}

export async function createReplayProposal(userDid: string, stake: number, idempotencyKey: string) {
  const mandate = await getOrCreateMandate(userDid);
  const proposal = createTradeProposal({
    id: newProposalId(),
    userDid,
    ...REPLAY_OPPORTUNITY,
    stake,
  }, mandate);
  return insertProposal(proposal, idempotencyKey);
}

export async function createLiveProposal(userDid: string, stake: number) {
  const mandate = await getOrCreateMandate(userDid);
  const scan = await scanOraMarkets(mandate);
  if (!scan.opportunity) return { proposal: null, scan };
  const opportunity = scan.opportunity;
  const proposal = createTradeProposal({
    id: newProposalId(),
    userDid,
    fixtureId: opportunity.fixtureId,
    match: opportunity.match,
    market: opportunity.market,
    line: opportunity.line,
    selection: opportunity.pick.selection,
    predictedProbabilityPct: opportunity.pick.prob,
    marketProbabilityPct: opportunity.pick.marketProb,
    evPct: opportunity.pick.evPct,
    quotedOdds: opportunity.pick.dec,
    stake,
  }, mandate);
  return { proposal: await insertProposal(proposal, opportunityKey(opportunity)), scan };
}

async function freshReplayCheck(proposal: TradeProposal): Promise<FreshExecutionCheck> {
  const bets = await getUserBets(proposal.userDid);
  return {
    fixtureId: proposal.fixtureId,
    market: proposal.market,
    line: proposal.line,
    selection: proposal.selection,
    odds: proposal.quotedOdds,
    evPct: proposal.evPct,
    availableBalance: balanceOf(bets),
    committedToday: await committedToday(proposal.userDid),
    simulationOk: true,
  };
}

async function freshLiveCheck(proposal: TradeProposal): Promise<FreshExecutionCheck> {
  const [pick, bets, committed] = await Promise.all([
    freshOraQuote(proposal.fixtureId, proposal.market, proposal.line),
    getUserBets(proposal.userDid),
    committedToday(proposal.userDid),
  ]);
  return {
    fixtureId: proposal.fixtureId,
    market: pick.market,
    line: pick.line,
    selection: pick.pick.selection,
    odds: pick.pick.dec,
    evPct: pick.pick.evPct,
    availableBalance: balanceOf(bets),
    committedToday: committed,
    simulationOk: pick.pick.value,
  };
}

const isReplayProposal = (proposal: TradeProposal) => proposal.fixtureId === REPLAY_OPPORTUNITY.fixtureId;

async function persistExecution(proposal: TradeProposal, fresh: FreshExecutionCheck) {
  const input = {
    fixtureId: proposal.fixtureId,
    match: proposal.match,
    market: proposal.market,
    line: proposal.line,
    selection: proposal.selection,
    odds: fresh.odds,
    stake: proposal.stake,
  };
  return isReplayProposal(proposal)
    ? placeReplayBet(proposal.userDid, proposal.id, input)
    : placeSupervisedBet(proposal.userDid, proposal.id, input);
}

export async function executeProposal(proposal: TradeProposal, trigger: ExecutionTrigger, nowMs = Date.now()) {
  if (proposal.status === "executing") {
    const recoveryFresh = isReplayProposal(proposal) ? await freshReplayCheck(proposal) : await freshLiveCheck(proposal);
    const recovered = await persistExecution(proposal, recoveryFresh);
    if (!recovered.ok) return updateProposal(proposal, failExecution(proposal, recovered.error), "execution_recovery_failed");
    return updateProposal(proposal, completeExecution(proposal, recovered.bet.execution_ref ?? `sportmonks-sandbox:${proposal.id}`), "execution_recovered");
  }
  const mandate = await getOrCreateMandate(proposal.userDid);
  const fresh = isReplayProposal(proposal) ? await freshReplayCheck(proposal) : await freshLiveCheck(proposal);
  const started = beginExecution(proposal, mandate, fresh, trigger, nowMs);
  if (started.status !== "executing") {
    return updateProposal(proposal, started, started.status === "expired" ? "proposal_expired" : "execution_blocked");
  }

  const claimed = await updateProposal(proposal, started, trigger === "user_approval" ? "user_approved" : "countdown_elapsed");
  const result = await persistExecution(proposal, fresh);
  if (!result.ok) {
    return updateProposal(claimed, failExecution(claimed, result.error), "execution_failed");
  }
  return updateProposal(claimed, completeExecution(claimed, result.bet.execution_ref ?? `replay:${proposal.id}`), "execution_completed");
}

export async function decideProposal(userDid: string, id: string, action: "approve" | "decline" | "change_stake", stake?: number) {
  const proposal = await getProposalForUser(id, userDid);
  if (!proposal) throw new Error("PROPOSAL_NOT_FOUND");
  if (action === "approve") return executeProposal(proposal, "user_approval");
  if (action === "decline") return updateProposal(proposal, declineProposal(proposal), "user_declined");
  if (!(stake && Number.isFinite(stake))) throw new Error("INVALID_STAKE");
  const mandate = await getOrCreateMandate(userDid);
  return updateProposal(proposal, changeProposalStake(proposal, mandate, stake), "stake_changed");
}

export async function processDueProposals(nowMs = Date.now()) {
  const due = await listDueProposals(new Date(nowMs).toISOString());
  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const proposal of due) {
    try {
      const updated = await executeProposal(proposal, "countdown_expiry", nowMs);
      results.push({ id: proposal.id, status: updated.status });
    } catch (error) {
      const message = (error as Error).message;
      if (message === "PROPOSAL_CONFLICT") results.push({ id: proposal.id, status: "already_claimed" });
      else results.push({ id: proposal.id, status: "error", error: message });
    }
  }
  return { checked: due.length, results };
}

export async function processUserDueProposals(userDid: string, nowMs = Date.now()) {
  const proposals = await listProposals(userDid, 100);
  const due = proposals.filter((proposal) => proposal.status === "pending" && Date.parse(proposal.decisionDeadlineAt) <= nowMs);
  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const proposal of due) {
    try {
      const updated = await executeProposal(proposal, "countdown_expiry", nowMs);
      results.push({ id: proposal.id, status: updated.status });
    } catch (error) {
      const message = (error as Error).message;
      if (message === "PROPOSAL_CONFLICT") results.push({ id: proposal.id, status: "already_claimed" });
      else results.push({ id: proposal.id, status: "error", error: message });
    }
  }
  return { checked: due.length, results };
}

export async function processAutonomousEngine(nowMs = Date.now()) {
  const due = await processDueProposals(nowMs);
  const mandates = await listActiveMandates();
  const scans: Array<{ userDid: string; status: "proposed" | "no_edge" | "deduplicated" | "error"; proposalId?: string; error?: string }> = [];
  for (const mandate of mandates) {
    try {
      const result = await createLiveProposal(mandate.userDid, Math.min(20, mandate.maxStake));
      if (!result.proposal) {
        scans.push({ userDid: mandate.userDid, status: "no_edge" });
        continue;
      }
      const createdAt = Date.parse(result.proposal.createdAt);
      scans.push({
        userDid: mandate.userDid,
        status: Math.abs(createdAt - nowMs) < 60_000 ? "proposed" : "deduplicated",
        proposalId: result.proposal.id,
      });
    } catch (error) {
      scans.push({ userDid: mandate.userDid, status: "error", error: (error as Error).message.slice(0, 160) });
    }
  }
  return { due, mandatesChecked: mandates.length, scans };
}
