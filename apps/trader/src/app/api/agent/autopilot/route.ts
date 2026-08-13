import { NextResponse } from "next/server";

/**
 * The old global autopilot could write ORA memos without a user-owned mandate. It is retired.
 * Authenticated live scans now enter through /api/trader/proposals, while the protected cron
 * continues at /api/cron/supervised-execution.
 */
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "AUTOPILOT_MOVED_TO_SUPERVISED_ENGINE",
    proposalEndpoint: "/api/trader/proposals",
  }, { status: 410 });
}
