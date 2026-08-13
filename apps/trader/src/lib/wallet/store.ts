import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

export type WalletEventStatus = "pending" | "confirmed" | "failed";

export type WalletEvent = {
  id: string;
  userDid: string;
  walletAddress: string;
  actionType: "faucet" | "allocate" | "withdraw";
  amount: number;
  tokenMint: string;
  cluster: "devnet";
  status: WalletEventStatus;
  idempotencyKey: string;
  txSignature: string | null;
  errorCode: string | null;
  createdAt: string;
};

type WalletEventRow = {
  id: string;
  user_did: string;
  wallet_address: string;
  action_type: WalletEvent["actionType"];
  amount: number | string;
  token_mint: string;
  cluster: "devnet";
  status: WalletEventStatus;
  idempotency_key: string;
  tx_signature: string | null;
  error_code: string | null;
  created_at: string;
};

function db() {
  if (!supabaseConfigured()) throw new Error("WALLET_STORE_UNAVAILABLE");
  return supabaseAdmin();
}

function toEvent(row: WalletEventRow): WalletEvent {
  return {
    id: row.id,
    userDid: row.user_did,
    walletAddress: row.wallet_address,
    actionType: row.action_type,
    amount: Number(row.amount),
    tokenMint: row.token_mint,
    cluster: row.cluster,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    txSignature: row.tx_signature,
    errorCode: row.error_code,
    createdAt: row.created_at,
  };
}

export async function reserveDailyFaucet(input: {
  userDid: string;
  walletAddress: string;
  amount: number;
  tokenMint: string;
  day: string;
}): Promise<{ event: WalletEvent; created: boolean }> {
  const idempotencyKey = `${input.userDid}:faucet:${input.day}`;
  const payload = {
    id: randomUUID(),
    user_did: input.userDid,
    wallet_address: input.walletAddress,
    action_type: "faucet",
    amount: input.amount,
    token_mint: input.tokenMint,
    cluster: "devnet",
    status: "pending",
    idempotency_key: idempotencyKey,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db().from("trader_wallet_events").insert(payload).select("*").single();
  if (!error) return { event: toEvent(data as WalletEventRow), created: true };
  if (error.code !== "23505") throw new Error(`WALLET_STORE_UNAVAILABLE: ${error.message}`);

  const existing = await db().from("trader_wallet_events").select("*")
    .eq("user_did", input.userDid).eq("idempotency_key", idempotencyKey).single();
  if (existing.error) throw new Error(`WALLET_STORE_UNAVAILABLE: ${existing.error.message}`);
  return { event: toEvent(existing.data as WalletEventRow), created: false };
}

export async function completeWalletEvent(id: string, status: "confirmed" | "failed", details: { txSignature?: string; errorCode?: string }): Promise<void> {
  const { error } = await db().from("trader_wallet_events").update({
    status,
    tx_signature: details.txSignature ?? null,
    error_code: details.errorCode ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "pending");
  if (error) throw new Error(`WALLET_STORE_UNAVAILABLE: ${error.message}`);
}

export async function recordConfirmedWalletEvent(input: {
  userDid: string;
  walletAddress: string;
  actionType: "allocate" | "withdraw";
  amount: number;
  tokenMint: string;
  txSignature: string;
}): Promise<WalletEvent> {
  const idempotencyKey = `${input.userDid}:${input.actionType}:${input.txSignature}`;
  const payload = {
    id: randomUUID(),
    user_did: input.userDid,
    wallet_address: input.walletAddress,
    action_type: input.actionType,
    amount: input.amount,
    token_mint: input.tokenMint,
    cluster: "devnet",
    status: "confirmed",
    idempotency_key: idempotencyKey,
    tx_signature: input.txSignature,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db().from("trader_wallet_events").insert(payload).select("*").single();
  if (!error) return toEvent(data as WalletEventRow);
  if (error.code !== "23505") throw new Error(`WALLET_STORE_UNAVAILABLE: ${error.message}`);
  const existing = await db().from("trader_wallet_events").select("*")
    .eq("user_did", input.userDid).eq("idempotency_key", idempotencyKey).single();
  if (existing.error) throw new Error(`WALLET_STORE_UNAVAILABLE: ${existing.error.message}`);
  return toEvent(existing.data as WalletEventRow);
}

export async function listWalletEvents(userDid: string, limit = 20): Promise<WalletEvent[]> {
  const { data, error } = await db().from("trader_wallet_events").select("*")
    .eq("user_did", userDid).order("created_at", { ascending: false }).limit(Math.min(limit, 50));
  if (error) throw new Error(`WALLET_STORE_UNAVAILABLE: ${error.message}`);
  return ((data ?? []) as WalletEventRow[]).map(toEvent);
}
