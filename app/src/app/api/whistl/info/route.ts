import { NextResponse } from "next/server";
import { WHISTL_PROGRAM_ID, TEST_USDC_MINT, pactPda, escrowPda } from "@/lib/whistl/program";

// Sanity endpoint: confirms the program client + IDL load and PDA derivation works.
export async function GET() {
  const sample = pactPda(1n);
  return NextResponse.json({
    ok: true,
    programId: WHISTL_PROGRAM_ID.toBase58(),
    usdcMint: TEST_USDC_MINT.toBase58(),
    oraPubkey: process.env.NEXT_PUBLIC_ORA_PUBKEY ?? null,
    samplePactPda: sample.toBase58(),
    sampleEscrowPda: escrowPda(sample).toBase58(),
  });
}
