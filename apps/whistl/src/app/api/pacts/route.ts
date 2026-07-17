import { NextResponse } from "next/server";
import { verifyPrivyToken, privyConfigured } from "@/lib/auth/privy-server";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";
import { PublicKey } from "@solana/web3.js";
import { devnetConnection } from "@/lib/whistl/server";
import { getProgram, pactPda, type AnchorWalletLike } from "@/lib/whistl/program";

function readOnlyWallet(publicKey: PublicKey): AnchorWalletLike {
  return {
    publicKey,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
}

/**
 * POST /api/pacts — Create a new pact (Supabase insert, auth-gated).
 *
 * The Privy access token is verified server-side. The DB write uses the
 * service-role key (server-only), scoped to the verified DID. Body shape:
 * { pact_id, fixture_id, competition, match_label, statement, terms, stake_usdc, creator_wallet }
 *
 * `pact_id` is created client-side before create_pact and is the on-chain PDA seed. The
 * database is strictly a mirror; it must never invent a different identifier.
 */
export async function POST(req: Request) {
  if (!privyConfigured() || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  }

  // Verify Privy token
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "NO_TOKEN" }, { status: 401 });

  let creatorDid: string;
  try {
    creatorDid = await verifyPrivyToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 401 });
  }

  // Parse body
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const {
    pact_id,
    fixture_id,
    competition,
    match_label,
    statement,
    terms,
    stake_usdc,
    creator_wallet,
  } = body;

  let pactId: bigint;
  try {
    pactId = BigInt(pact_id);
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_PACT_ID" }, { status: 400 });
  }

  if (!fixture_id || !statement || !terms || !stake_usdc || pactId < 0n) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: pact_id, fixture_id, statement, terms, stake_usdc" },
      { status: 400 },
    );
  }
  if (typeof creator_wallet !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_CREATOR_WALLET" }, { status: 400 });
  }

  // The database is an index of the real escrow, never a source of truth. Reject a mirror
  // record unless its immutable on-chain pact already exists and agrees with the submitted core.
  try {
    const creator = new PublicKey(creator_wallet);
    const program = getProgram(devnetConnection(), readOnlyWallet(creator));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chainPact = await (program.account as any).pact.fetch(pactPda(pactId)) as {
      creator: PublicKey;
      fixtureId: { toString: () => string };
      stakeAmount: { toString: () => string };
    };
    const expectedStake = BigInt(Math.round(Number(stake_usdc) * 1_000_000));
    if (
      !chainPact.creator.equals(creator) ||
      chainPact.fixtureId.toString() !== String(fixture_id) ||
      chainPact.stakeAmount.toString() !== expectedStake.toString()
    ) {
      return NextResponse.json({ ok: false, error: "ONCHAIN_PACT_MISMATCH" }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "ONCHAIN_PACT_NOT_FOUND" }, { status: 409 });
  }

  const { data: pact, error } = await supabaseAdmin()
    .from("pacts")
    .insert({
      pact_id: pactId.toString(),
      fixture_id,
      competition: competition ?? null,
      match_label: match_label ?? null,
      statement,
      terms,
      stake_usdc,
      creator_did: creatorDid,
      creator_wallet: typeof creator_wallet === "string" ? creator_wallet : null,
      status: "created",
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/pacts] Supabase insert error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pact });
}

/**
 * GET /api/pacts — List pacts (publicly readable per RLS).
 *
 * Optional query params:
 *   ?fixture_id=123   — filter by fixture
 *   ?status=created   — filter by status (created | accepted | settled | cancelled)
 *   ?creator_did=did  — filter by creator
 */
export async function GET(req: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const fixtureId = searchParams.get("fixture_id");
  const status = searchParams.get("status");
  const creatorDid = searchParams.get("creator_did");

  let query = supabaseAdmin()
    .from("pacts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (fixtureId) query = query.eq("fixture_id", Number(fixtureId));
  if (status) query = query.eq("status", status);
  if (creatorDid) query = query.eq("creator_did", creatorDid);

  const { data: pacts, error } = await query;

  if (error) {
    console.error("[GET /api/pacts] Supabase query error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pacts });
}
