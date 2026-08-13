import { NextResponse } from "next/server";
import { RequestAuthError, requirePrivyDid } from "@/lib/auth/request";
import { decideProposal } from "@/lib/supervision/service";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const did = await requirePrivyDid(req);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "INVALID_PROPOSAL_ID" }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (action !== "approve" && action !== "decline" && action !== "change_stake") {
      return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
    }
    const proposal = await decideProposal(did, id, action, body.stake == null ? undefined : Number(body.stake));
    return NextResponse.json({ ok: true, proposal });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    const message = (error as Error).message;
    const status = message === "PROPOSAL_NOT_FOUND" ? 404 : message === "PROPOSAL_CONFLICT" ? 409 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
