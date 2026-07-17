import { NextResponse } from "next/server";
import { Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { devnetConnection, oraKeypair, nodeWallet } from "@/lib/whistl/server";
import { getProgram, buildAcceptPact, pactPda } from "@/lib/whistl/program";
import { getOddsSnapshot } from "@/lib/txline/server";
import { parse1X2, parseOU, type TxOddsEntry } from "@/lib/txline/types";
import { priceQuote, type MarketContext, type PactTerms } from "@/lib/ora/pricer";

// ORA accepts a freshly-created pact: matches the stake on-chain as the counterparty.
// Only accepts pacts that are genuinely open (status 0 = Created, no counterparty yet).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body?.pactId == null) return NextResponse.json({ ok: false, error: "NO_PACT_ID" }, { status: 400 });
  let pactId: bigint;
  try {
    pactId = BigInt(body.pactId);
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_PACT_ID" }, { status: 400 });
  }

  try {
    const conn = devnetConnection();
    const ora = oraKeypair();
    const program = getProgram(conn, nodeWallet(ora));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pact = (await (program.account as any).pact.fetch(pactPda(pactId))) as {
      status: number;
      stakeAmount: { toNumber: () => number };
      fixtureId: { toNumber: () => number };
      threshold: number; comparison: number; statAKey: number; statAPeriod: number;
      hasStatB: boolean; statBKey: number; statBPeriod: number; op: number | null;
    };
    if (pact.status !== 0) {
      return NextResponse.json({ ok: false, error: "PACT_NOT_OPEN", status: pact.status }, { status: 409 });
    }

    const terms: PactTerms = {
      threshold: pact.threshold, comparison: pact.comparison, statAKey: pact.statAKey,
      statAPeriod: pact.statAPeriod, hasStatB: pact.hasStatB, statBKey: pact.statBKey,
      statBPeriod: pact.statBPeriod, op: pact.op,
    };
    let marketCtx: MarketContext = {};
    try {
      const odds = (await getOddsSnapshot(pact.fixtureId.toNumber())) as TxOddsEntry[];
      marketCtx = { x12: parse1X2(odds) ?? undefined, ou: parseOU(odds) ?? undefined };
    } catch { /* model-only quote is explicitly labelled by ORA */ }
    const quote = priceQuote(terms, marketCtx);

    // Compute ORA's fair counter-stake from immutable terms and its verified quote.
    // If pTrue = probability creator wins, then ORA stakes: creatorStake * (1-pTrue) / pTrue
    // This makes the bet zero-EV for both sides.
    const pTrue = quote.probabilityTrue;
    const creatorStakeRaw = pact.stakeAmount.toNumber();
    const oraStakeRaw = Math.round(creatorStakeRaw * (1 - pTrue) / pTrue);
    const oraStakeBaseUnits = BigInt(Math.max(oraStakeRaw, 1));

    const ix = await buildAcceptPact(program, {
      pactId,
      counterparty: ora.publicKey,
      counterpartyStakeBaseUnits: oraStakeBaseUnits,
    });
    const tx = new Transaction().add(ix);
    tx.feePayer = ora.publicKey;
    tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
    const sig = await sendAndConfirmTransaction(conn, tx, [ora], { commitment: "confirmed" });

    // Auto-start the keeper sentinel so it watches the match and settles this pact.
    // body may contain { fixtureId, p1, p2, pact } for the sentinel to track.
    if (body?.fixtureId && body?.p1 && body?.p2 && body?.pact) {
      fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")}/api/ora/keeper`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fixtureId: body.fixtureId,
            p1: body.p1,
            p2: body.p2,
            pacts: [body.pact],
            speed: 6,
          }),
          cache: "no-store",
        },
      ).catch(() => {});
    }

    const USDC_DECIMALS = 6;
    return NextResponse.json({
      ok: true,
      sig,
      counterparty: ora.publicKey.toBase58(),
      oraStakeUsdc: Number(oraStakeBaseUnits) / 10 ** USDC_DECIMALS,
      quote,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
