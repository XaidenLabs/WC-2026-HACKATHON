import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";
import {
  defaultMandate,
  type TradeProposal,
  type TradingMandate,
} from "./domain";

type MandateRow = {
  user_did: string;
  auto_execute: boolean;
  paused: boolean;
  killed: boolean;
  max_stake: number | string;
  max_daily_stake: number | string;
  min_ev_pct: number | string;
  max_odds_drift_pct: number | string;
  allowed_markets: TradingMandate["allowedMarkets"];
  updated_at: string;
};

type ProposalRow = {
  id: string;
  user_did: string;
  fixture_id: number | string;
  match: string;
  market: TradeProposal["market"];
  line: number | string | null;
  selection: TradeProposal["selection"];
  predicted_probability_pct: number | string;
  market_probability_pct: number | string;
  ev_pct: number | string;
  quoted_odds: number | string;
  stake: number | string;
  status: TradeProposal["status"];
  auto_execute_authorized: boolean;
  created_at: string;
  decision_deadline_at: string;
  execution_deadline_at: string;
  trigger: TradeProposal["trigger"];
  decision_reason: string | null;
  execution_ref: string | null;
  version: number;
};

function requireStore() {
  if (!supabaseConfigured()) throw new Error("SUPERVISION_STORE_UNAVAILABLE");
  return supabaseAdmin();
}

const number = (value: number | string | null) => value == null ? null : Number(value);

function toMandate(row: MandateRow): TradingMandate {
  return {
    userDid: row.user_did,
    autoExecute: row.auto_execute,
    paused: row.paused,
    killed: row.killed,
    maxStake: Number(row.max_stake),
    maxDailyStake: Number(row.max_daily_stake),
    minEvPct: Number(row.min_ev_pct),
    maxOddsDriftPct: Number(row.max_odds_drift_pct),
    allowedMarkets: row.allowed_markets,
    updatedAt: row.updated_at,
  };
}

function toProposal(row: ProposalRow): TradeProposal {
  return {
    id: row.id,
    userDid: row.user_did,
    fixtureId: Number(row.fixture_id),
    match: row.match,
    market: row.market,
    line: number(row.line),
    selection: row.selection,
    predictedProbabilityPct: Number(row.predicted_probability_pct),
    marketProbabilityPct: Number(row.market_probability_pct),
    evPct: Number(row.ev_pct),
    quotedOdds: Number(row.quoted_odds),
    stake: Number(row.stake),
    status: row.status,
    autoExecuteAuthorized: row.auto_execute_authorized,
    createdAt: row.created_at,
    decisionDeadlineAt: row.decision_deadline_at,
    executionDeadlineAt: row.execution_deadline_at,
    trigger: row.trigger,
    decisionReason: row.decision_reason,
    executionRef: row.execution_ref,
    version: row.version,
  };
}

function proposalFields(proposal: TradeProposal) {
  return {
    id: proposal.id,
    user_did: proposal.userDid,
    fixture_id: proposal.fixtureId,
    match: proposal.match,
    market: proposal.market,
    line: proposal.line,
    selection: proposal.selection,
    predicted_probability_pct: proposal.predictedProbabilityPct,
    market_probability_pct: proposal.marketProbabilityPct,
    ev_pct: proposal.evPct,
    quoted_odds: proposal.quotedOdds,
    stake: proposal.stake,
    status: proposal.status,
    auto_execute_authorized: proposal.autoExecuteAuthorized,
    created_at: proposal.createdAt,
    decision_deadline_at: proposal.decisionDeadlineAt,
    execution_deadline_at: proposal.executionDeadlineAt,
    trigger: proposal.trigger,
    decision_reason: proposal.decisionReason,
    execution_ref: proposal.executionRef,
    version: proposal.version,
    updated_at: new Date().toISOString(),
  };
}

export async function getOrCreateMandate(userDid: string): Promise<TradingMandate> {
  const db = requireStore();
  const { data, error } = await db.from("trader_mandates").select("*").eq("user_did", userDid).maybeSingle();
  if (error) throw new Error(`SUPERVISION_STORE_UNAVAILABLE: ${error.message}`);
  if (data) return toMandate(data as MandateRow);
  const mandate = defaultMandate(userDid);
  return saveMandate(mandate);
}

export async function saveMandate(mandate: TradingMandate): Promise<TradingMandate> {
  const updatedAt = new Date().toISOString();
  const { data, error } = await requireStore().from("trader_mandates").upsert({
    user_did: mandate.userDid,
    auto_execute: mandate.autoExecute,
    paused: mandate.paused,
    killed: mandate.killed,
    max_stake: mandate.maxStake,
    max_daily_stake: mandate.maxDailyStake,
    min_ev_pct: mandate.minEvPct,
    max_odds_drift_pct: mandate.maxOddsDriftPct,
    allowed_markets: mandate.allowedMarkets,
    updated_at: updatedAt,
  }).select("*").single();
  if (error) throw new Error(`SUPERVISION_STORE_UNAVAILABLE: ${error.message}`);
  return toMandate(data as MandateRow);
}

export async function insertProposal(proposal: TradeProposal, idempotencyKey: string): Promise<TradeProposal> {
  const db = requireStore();
  const { data, error } = await db.from("trader_proposals").insert({
    ...proposalFields(proposal),
    idempotency_key: idempotencyKey.slice(0, 160),
  }).select("*").single();
  if (error?.code === "23505") {
    const existing = await db.from("trader_proposals").select("*")
      .eq("user_did", proposal.userDid).eq("idempotency_key", idempotencyKey.slice(0, 160)).single();
    if (existing.error) throw new Error(existing.error.message);
    return toProposal(existing.data as ProposalRow);
  }
  if (error) throw new Error(error.message);
  const saved = toProposal(data as ProposalRow);
  await appendProposalEvent(saved, "proposal_created", { status: saved.status, idempotencyKey });
  return saved;
}

export async function getProposalForUser(id: string, userDid: string): Promise<TradeProposal | null> {
  const { data, error } = await requireStore().from("trader_proposals").select("*")
    .eq("id", id).eq("user_did", userDid).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProposal(data as ProposalRow) : null;
}

export async function listProposals(userDid: string, limit = 20): Promise<TradeProposal[]> {
  const { data, error } = await requireStore().from("trader_proposals").select("*")
    .eq("user_did", userDid).order("created_at", { ascending: false }).limit(Math.min(limit, 100));
  if (error) throw new Error(error.message);
  return ((data ?? []) as ProposalRow[]).map(toProposal);
}

export async function listActiveMandates(limit = 100): Promise<TradingMandate[]> {
  const { data, error } = await requireStore().from("trader_mandates").select("*")
    .eq("killed", false).eq("paused", false).limit(Math.min(limit, 500));
  if (error) throw new Error(error.message);
  return ((data ?? []) as MandateRow[]).map(toMandate);
}

export async function listDueProposals(nowIso: string, limit = 50): Promise<TradeProposal[]> {
  const { data, error } = await requireStore().from("trader_proposals").select("*")
    .in("status", ["pending", "executing"]).lte("decision_deadline_at", nowIso)
    .order("decision_deadline_at", { ascending: true }).limit(Math.min(limit, 100));
  if (error) throw new Error(error.message);
  return ((data ?? []) as ProposalRow[]).map(toProposal);
}

export async function updateProposal(previous: TradeProposal, next: TradeProposal, eventType: string): Promise<TradeProposal> {
  if (next.version !== previous.version + 1) throw new Error("INVALID_PROPOSAL_VERSION");
  const { data, error } = await requireStore().from("trader_proposals")
    .update(proposalFields(next))
    .eq("id", previous.id)
    .eq("user_did", previous.userDid)
    .eq("version", previous.version)
    .select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("PROPOSAL_CONFLICT");
  const saved = toProposal(data as ProposalRow);
  await appendProposalEvent(saved, eventType, {
    from: previous.status,
    to: saved.status,
    trigger: saved.trigger,
    reason: saved.decisionReason,
    executionRef: saved.executionRef,
    version: saved.version,
  });
  return saved;
}

export async function committedToday(userDid: string, nowMs = Date.now()): Promise<number> {
  const start = new Date(nowMs);
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await requireStore().from("trader_proposals").select("stake")
    .eq("user_did", userDid).eq("status", "executed").gte("updated_at", start.toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + Number(row.stake), 0);
}

async function appendProposalEvent(proposal: TradeProposal, eventType: string, payload: Record<string, unknown>) {
  const db = requireStore();
  const { data: previous } = await db.from("trader_proposal_events").select("event_hash")
    .eq("proposal_id", proposal.id).order("sequence", { ascending: false }).limit(1).maybeSingle();
  const previousHash = previous?.event_hash ?? null;
  const createdAt = new Date().toISOString();
  const eventPayload = { ...payload, proposalId: proposal.id, userDid: proposal.userDid, createdAt };
  const eventHash = createHash("sha256")
    .update(JSON.stringify({ previousHash, eventType, eventPayload }))
    .digest("hex");
  const { error } = await db.from("trader_proposal_events").insert({
    proposal_id: proposal.id,
    user_did: proposal.userDid,
    event_type: eventType,
    event_payload: eventPayload,
    previous_hash: previousHash,
    event_hash: eventHash,
    created_at: createdAt,
  });
  if (error) throw new Error(`AUDIT_EVENT_FAILED: ${error.message}`);
}

export const newProposalId = () => randomUUID();
