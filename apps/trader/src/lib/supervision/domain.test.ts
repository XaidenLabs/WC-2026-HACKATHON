import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVAL_WINDOW_MS,
  beginExecution,
  changeProposalStake,
  completeExecution,
  createTradeProposal,
  declineProposal,
  defaultMandate,
  type FreshExecutionCheck,
} from "./domain.ts";

const T0 = Date.UTC(2026, 7, 6, 10, 0, 0);

function fixture() {
  const mandate = { ...defaultMandate("did:privy:user", T0), autoExecute: true };
  const proposal = createTradeProposal({
    id: "proposal-1",
    userDid: mandate.userDid,
    fixtureId: 1001,
    match: "Arsenal v Liverpool",
    market: "1x2",
    line: null,
    selection: "home",
    predictedProbabilityPct: 51,
    marketProbabilityPct: 45,
    evPct: 6.4,
    quotedOdds: 2.2,
    stake: 20,
  }, mandate, T0);
  const fresh: FreshExecutionCheck = {
    fixtureId: 1001,
    market: "1x2",
    line: null,
    selection: "home",
    odds: 2.18,
    evPct: 6.1,
    availableBalance: 100,
    committedToday: 0,
    simulationOk: true,
  };
  return { mandate, proposal, fresh };
}

test("user approval starts execution immediately and produces a receipt", () => {
  const { mandate, proposal, fresh } = fixture();
  const executing = beginExecution(proposal, mandate, fresh, "user_approval", T0 + 10_000);
  assert.equal(executing.status, "executing");
  assert.equal(executing.trigger, "user_approval");
  assert.equal(completeExecution(executing, "replay:approved").status, "executed");
});

test("explicit decline is terminal", () => {
  const { proposal } = fixture();
  const declined = declineProposal(proposal, T0 + 20_000);
  assert.equal(declined.status, "declined");
  assert.throws(() => declineProposal(declined, T0 + 30_000));
});

test("silence executes only after the five-minute window", () => {
  const { mandate, proposal, fresh } = fixture();
  const early = beginExecution(proposal, mandate, fresh, "countdown_expiry", T0 + APPROVAL_WINDOW_MS - 1);
  assert.equal(early.status, "blocked");

  const onTime = beginExecution(proposal, mandate, fresh, "countdown_expiry", T0 + APPROVAL_WINDOW_MS);
  assert.equal(onTime.status, "executing");
  assert.equal(onTime.trigger, "countdown_expiry");
});

test("auto mode off converts silence into expiry", () => {
  const { mandate, fresh } = fixture();
  mandate.autoExecute = false;
  const proposal = createTradeProposal({
    ...fixture().proposal,
    id: "proposal-auto-off",
  }, mandate, T0);
  const result = beginExecution(proposal, mandate, fresh, "countdown_expiry", T0 + APPROVAL_WINDOW_MS);
  assert.equal(result.status, "expired");
  assert.match(result.decisionReason ?? "", /NOT_PREAUTHORIZED/);
});

test("pause and kill switch fail closed", () => {
  const paused = fixture();
  paused.mandate.paused = true;
  assert.equal(beginExecution(paused.proposal, paused.mandate, paused.fresh, "countdown_expiry", T0 + APPROVAL_WINDOW_MS).status, "blocked");

  const killed = fixture();
  killed.mandate.killed = true;
  assert.equal(beginExecution(killed.proposal, killed.mandate, killed.fresh, "user_approval", T0 + 1_000).status, "blocked");
});

test("fresh price, EV, balance, daily exposure, and simulation are mandatory", () => {
  const cases: Array<Partial<FreshExecutionCheck>> = [
    { odds: 1.8 },
    { evPct: 2 },
    { availableBalance: 10 },
    { committedToday: 70 },
    { simulationOk: false },
    { fixtureId: 9999 },
  ];
  for (const changed of cases) {
    const { mandate, proposal, fresh } = fixture();
    const result = beginExecution(proposal, mandate, { ...fresh, ...changed }, "countdown_expiry", T0 + APPROVAL_WINDOW_MS);
    assert.equal(result.status, "blocked");
  }
});

test("changing stake restarts the full review window", () => {
  const { mandate, proposal } = fixture();
  const changedAt = T0 + 120_000;
  const changed = changeProposalStake(proposal, mandate, 15, changedAt);
  assert.equal(changed.stake, 15);
  assert.equal(Date.parse(changed.decisionDeadlineAt), changedAt + APPROVAL_WINDOW_MS);
  assert.equal(changed.version, proposal.version + 1);
});

test("proposal creation rejects stake and probability values outside the mandate", () => {
  const { mandate, proposal } = fixture();
  assert.throws(() => createTradeProposal({ ...proposal, id: "too-large", stake: mandate.maxStake + 1 }, mandate, T0), /exceeds/);
  assert.throws(() => createTradeProposal({ ...proposal, id: "bad-probability", predictedProbabilityPct: 101 }, mandate, T0), /probability/);
});
