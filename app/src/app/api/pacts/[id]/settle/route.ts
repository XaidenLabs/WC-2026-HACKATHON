import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

// POST /api/pacts/[id]/settle — updates Supabase pact record after on-chain settlement.
// Body: { isTrue: boolean, finalValue: number, txSig?: string, winner?: "creator" | "counterparty" }
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { isTrue, finalValue, txSig, winnerDid } = body ?? {};

  const { error } = await supabaseAdmin()
    .from("pacts")
    .update({ status: "settled", winner_did: winnerDid ?? null })
    .eq("pact_id", id);

  if (error) {
    console.error("[POST /api/pacts/[id]/settle] Supabase error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
