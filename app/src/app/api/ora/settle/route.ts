import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { devnetConnection, oraKeypair, nodeWallet, settlePactOnChain } from "@/lib/whistl/server";
import { getProgram, pactPda } from "@/lib/whistl/program";
import type { SettlePactProof } from "@/lib/whistl/program";

// POST /api/ora/settle — ORA fetches proof from TxLINE and submits settle_pact on-chain.
// Body: { pactId: string|number, fixtureId: number, statAKey: number, statBKey?: number }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { pactId: pactIdRaw, fixtureId, statAKey, statBKey } = body ?? {};

  if (pactIdRaw == null || !fixtureId || !statAKey) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST: need pactId, fixtureId, statAKey" }, { status: 400 });
  }

  let pactId: bigint;
  try {
    pactId = BigInt(pactIdRaw);
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_PACT_ID" }, { status: 400 });
  }

  try {
    // Read pact from chain to verify status and get creator/counterparty.
    const conn = devnetConnection();
    const ora = oraKeypair();
    const program = getProgram(conn, nodeWallet(ora));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pact = (await (program.account as any).pact.fetch(pactPda(pactId))) as {
      status: number;
      creator: PublicKey;
      counterparty: { toBase58: () => string } | null;
    };

    if (pact.status !== 1) {
      return NextResponse.json({ ok: false, error: "PACT_NOT_ACCEPTED", onChainStatus: pact.status }, { status: 409 });
    }
    if (!pact.counterparty) {
      return NextResponse.json({ ok: false, error: "NO_COUNTERPARTY" }, { status: 409 });
    }

    // Fetch the Merkle proof from TxLINE via our proxy.
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const proofUrl = `${base}/api/txline/proof?fixtureId=${fixtureId}&statAKey=${statAKey}${statBKey ? `&statBKey=${statBKey}` : ""}`;
    const proofRes = await fetch(proofUrl, { cache: "no-store" });

    if (!proofRes.ok) {
      const err = await proofRes.json().catch(() => ({}));
      return NextResponse.json({ ok: false, error: err?.error ?? "PROOF_FETCH_FAILED" }, { status: 502 });
    }

    const proofJson = await proofRes.json();
    const proof = proofJson.proof as SettlePactProof;
    if (!proof?.summary) {
      return NextResponse.json({ ok: false, error: "INVALID_PROOF" }, { status: 502 });
    }

    const sig = await settlePactOnChain({
      pactId,
      creator: pact.creator,
      counterparty: new PublicKey(pact.counterparty.toBase58()),
      proof,
    });

    return NextResponse.json({ ok: true, sig, explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet` });
  } catch (e) {
    const msg = (e as Error).message ?? "unknown";
    console.error("[/api/ora/settle] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
