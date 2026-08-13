import { NextResponse } from "next/server";
import { RequestAuthError, requirePrivyDid } from "@/lib/auth/request";
import { createLiveProposal, createReplayProposal, readSupervision } from "@/lib/supervision/service";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  const message = (error as Error).message;
  return NextResponse.json({ ok: false, error: message }, { status: message.includes("UNAVAILABLE") ? 503 : 400 });
}

export async function GET(req: Request) {
  try {
    const did = await requirePrivyDid(req);
    const { proposals } = await readSupervision(did);
    return NextResponse.json({ ok: true, proposals });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: Request) {
  try {
    const did = await requirePrivyDid(req);
    const idempotencyKey = (req.headers.get("idempotency-key") ?? "").trim();
    if (!/^[A-Za-z0-9:_-]{8,160}$/.test(idempotencyKey)) {
      return NextResponse.json({ ok: false, error: "VALID_IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const stake = Number(body.stake);
    if (!Number.isFinite(stake)) return NextResponse.json({ ok: false, error: "INVALID_STAKE" }, { status: 400 });
    if (body.mode === "replay") {
      return NextResponse.json({ ok: true, proposal: await createReplayProposal(did, stake, idempotencyKey), environment: "replay" }, { status: 201 });
    }
    const result = await createLiveProposal(did, stake);
    return NextResponse.json({ ok: true, ...result, environment: "sportmonks_sandbox" }, { status: result.proposal ? 201 : 200 });
  } catch (error) {
    return failure(error);
  }
}
