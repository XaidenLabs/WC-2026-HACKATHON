import { NextResponse } from "next/server";

// Settlement records are written only by /api/ora/fulfill after an on-chain
// settlement succeeds. This legacy endpoint used to let any caller mark a pact
// settled and could overwrite the verified winner with null.
export async function POST() {
  return NextResponse.json({ ok: false, error: "SETTLEMENT_ENDPOINT_RETIRED" }, { status: 410 });
}
