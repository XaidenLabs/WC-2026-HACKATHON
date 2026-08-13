import { NextResponse } from "next/server";
import { RequestAuthError, requirePrivyDid } from "@/lib/auth/request";
import { processUserDueProposals } from "@/lib/supervision/service";

export async function POST(req: Request) {
  try {
    const did = await requirePrivyDid(req);
    return NextResponse.json({ ok: true, ...(await processUserDueProposals(did)) });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
