import "server-only";
import { NextResponse } from "next/server";
import { Transaction, sendAndConfirmTransaction, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {
  devnetConnection,
  oraKeypair,
  nodeWallet,
  settlePactOnChain,
  mintAuthorityKeypair,
} from "@/lib/whistl/server";
import { getProgram, buildAcceptPact, pactPda, TEST_USDC_MINT } from "@/lib/whistl/program";
import type { SettlePactProof } from "@/lib/whistl/program";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

const USDC_DECIMALS = 6;

type PactAccount = {
  status: number;
  creator: PublicKey;
  counterparty: { toBase58: () => string } | null;
  stakeAmount: { toNumber: () => number };
};

type Terms = {
  hasStatB?: boolean;
  op?: number | null;
  comparison?: number;
  threshold?: number;
};

function computeOutcome(proof: SettlePactProof, terms: Terms | null | undefined) {
  if (!terms || terms.comparison == null || terms.threshold == null) return {};
  const valA = proof.statToProve.value;
  const valB = proof.statToProve2?.value ?? 0;
  const combined = terms.hasStatB
    ? (terms.op === 1 ? valA - valB : valA + valB)
    : valA;
  const { comparison, threshold } = terms;
  const isTrue =
    comparison === 0 ? combined > threshold :
    comparison === 1 ? combined < threshold :
    combined === threshold;
  return { isTrue, finalValue: combined };
}

// POST /api/ora/fulfill
// Proof-first accept+settle: fetches TxLINE proof before any on-chain write so calling
// this for an in-progress match never locks ORA's stake.
//
// Flow:
//  1. Fetch Merkle proof — if unavailable the match isn't over; bail early (no side effects).
//  2. Try to load the on-chain pact.
//     • "Account does not exist" → demo settle: evaluate proof, write DB only.
//     • status 0 → accept then settle.
//     • status 1 → settle only.
//     • other   → error.
//  3. Update Supabase.
//
// Body: { pactId, fixtureId, statAKey, statBKey?, baselinePTrue?, terms? }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const {
    pactId: pactIdRaw,
    fixtureId,
    statAKey,
    statBKey,
    baselinePTrue = 0.5,
    terms,
  } = body ?? {};

  if (pactIdRaw == null || !fixtureId || !statAKey) {
    return NextResponse.json(
      { ok: false, error: "BAD_REQUEST: need pactId, fixtureId, statAKey" },
      { status: 400 },
    );
  }

  let pactId: bigint;
  try {
    pactId = BigInt(pactIdRaw);
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_PACT_ID" }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  // ── Step 1: Fetch proof FIRST — if the match isn't over this will fail and we
  //    return early without touching any on-chain state.
  const proofUrl =
    `${base}/api/txline/proof?fixtureId=${fixtureId}&statAKey=${statAKey}` +
    (statBKey ? `&statBKey=${statBKey}` : "");
  const proofRes = await fetch(proofUrl, { cache: "no-store" });

  if (!proofRes.ok) {
    const err = await proofRes.json().catch(() => ({}));
    const reason = err?.error ?? "PROOF_UNAVAILABLE";
    // Treat proof unavailability as "match not finished" — not an error the caller needs to surface.
    return NextResponse.json(
      { ok: false, error: reason, matchNotFinished: true },
      { status: 422 },
    );
  }

  const proofJson = await proofRes.json();
  const proof = proofJson.proof as SettlePactProof;
  if (!proof?.summary) {
    return NextResponse.json({ ok: false, error: "INVALID_PROOF" }, { status: 502 });
  }

  // Compute predicate outcome from proof + terms.
  const { isTrue, finalValue } = computeOutcome(proof, terms);

  // Helper: write settlement to Supabase.
  // Only update columns that exist in the schema (status, winner_did).
  // Extra columns (final_value, predicate_result, settle_tx_sig, settled_at) may not
  // exist in all environments — including them causes the entire update to fail.
  async function dbSettle(_txSig?: string, winnerDid?: string | null) {
    if (!supabaseConfigured()) return;
    const { error } = await supabaseAdmin()
      .from("pacts")
      .update({ status: "settled", winner_did: winnerDid ?? null })
      .eq("pact_id", String(pactId));
    if (error) console.error("[fulfill] Supabase settle error:", error.message);
  }

  // Helper: load the creator's DID, wallet, and stake so we can award + pay the winner.
  async function getPactRow(): Promise<
    { creator_did: string | null; creator_wallet: string | null; stake_usdc: number | null } | null
  > {
    if (!supabaseConfigured()) return null;
    const { data } = await supabaseAdmin()
      .from("pacts")
      .select("creator_did, creator_wallet, stake_usdc")
      .eq("pact_id", String(pactId))
      .single();
    return data ?? null;
  }

  // isTrue → creator wins; false → ORA wins (store "ora" so displayStatus → "lost").
  function winnerDidFor(row: { creator_did: string | null } | null): string | null {
    if (isTrue == null) return null;
    return isTrue ? (row?.creator_did ?? null) : "ora";
  }

  // Demo payout: the creator's stake was never escrowed on-chain, so a win has to be
  // credited to their wallet directly. Mint the even-money profit (= stake) with the
  // test-USDC mint authority — same mechanism as /api/faucet. Best-effort; never throws.
  async function payoutWinnings(walletAddress: string, profitUsdc: number) {
    if (profitUsdc <= 0) return;
    try {
      const conn = devnetConnection();
      const authority = mintAuthorityKeypair();
      const owner = new PublicKey(walletAddress);
      const ata = await getOrCreateAssociatedTokenAccount(conn, authority, TEST_USDC_MINT, owner);
      await mintTo(
        conn, authority, TEST_USDC_MINT, ata.address, authority,
        Math.round(profitUsdc * 10 ** USDC_DECIMALS),
      );
    } catch (e) {
      console.error("[fulfill] payout mint failed:", (e as Error).message);
    }
  }

  try {
    const conn = devnetConnection();
    const ora = oraKeypair();
    const program = getProgram(conn, nodeWallet(ora));

    // ── Step 2: Load on-chain pact.
    let pact: PactAccount | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pact = (await (program.account as any).pact.fetch(pactPda(pactId))) as PactAccount;
    } catch (fetchErr) {
      const msg = (fetchErr as Error).message ?? "";
      const isNotFound =
        msg.includes("Account does not exist") ||
        msg.includes("could not find account") ||
        msg.includes("has no data");

      if (!isNotFound) throw fetchErr;

      // ── Demo settle: pact not on-chain, but proof is real.
      const row = await getPactRow();
      const winnerDid = winnerDidFor(row);
      // On a win, credit the creator's wallet so their balance reflects the payout.
      if (isTrue && row?.creator_wallet) {
        await payoutWinnings(row.creator_wallet, row.stake_usdc ?? 0);
      }
      await dbSettle(undefined, winnerDid);
      return NextResponse.json({
        ok: true,
        demo: true,
        isTrue,
        finalValue,
        paidOut: isTrue ? (row?.stake_usdc ?? 0) : 0,
        note: "Pact not on-chain — result verified via TxLINE Merkle proof.",
      });
    }

    // ── Step 3: Accept if still in Created state.
    let acceptSig: string | null = null;
    if (pact.status === 0) {
      const pTrue = Math.max(0.05, Math.min(0.95, baselinePTrue));
      const creatorStakeRaw = pact.stakeAmount.toNumber();
      const oraStake = Math.round(creatorStakeRaw * (1 - pTrue) / pTrue);
      const oraStakeBaseUnits = BigInt(Math.max(oraStake, 1));

      const ix = await buildAcceptPact(program, {
        pactId,
        counterparty: ora.publicKey,
        counterpartyStakeBaseUnits: oraStakeBaseUnits,
      });
      const tx = new Transaction().add(ix);
      tx.feePayer = ora.publicKey;
      tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
      acceptSig = await sendAndConfirmTransaction(conn, tx, [ora], { commitment: "confirmed" });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pact = (await (program.account as any).pact.fetch(pactPda(pactId))) as PactAccount;
    } else if (pact.status !== 1) {
      return NextResponse.json(
        { ok: false, error: `PACT_STATUS_${pact.status}_NOT_SETTLEABLE` },
        { status: 409 },
      );
    }

    if (!pact.counterparty) {
      return NextResponse.json({ ok: false, error: "NO_COUNTERPARTY" }, { status: 409 });
    }

    // ── Step 4: Settle on-chain.
    const settleSig = await settlePactOnChain({
      pactId,
      creator: pact.creator,
      counterparty: new PublicKey(pact.counterparty.toBase58()),
      proof,
    });

    // ── Step 5: Update Supabase. (On-chain settle_pact already released escrow to the
    // winner's ATA, so no extra mint here — the balance updates from the program payout.)
    const winnerDid = winnerDidFor(await getPactRow());
    await dbSettle(settleSig, winnerDid);

    return NextResponse.json({
      ok: true,
      demo: false,
      acceptSig,
      settleSig,
      isTrue,
      finalValue,
      explorerUrl: `https://explorer.solana.com/tx/${settleSig}?cluster=devnet`,
    });
  } catch (e) {
    const msg = (e as Error).message ?? "unknown";
    console.error("[/api/ora/fulfill] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
