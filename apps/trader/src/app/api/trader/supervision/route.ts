import { NextResponse } from "next/server";
import { RequestAuthError, requirePrivyDid } from "@/lib/auth/request";
import { readSupervision, updateMandate } from "@/lib/supervision/service";
import type { SupervisedMarket, TradingMandate } from "@/lib/supervision/domain";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  const message = (error as Error).message;
  const status = message.includes("UNAVAILABLE") ? 503 : 400;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request) {
  try {
    const did = await requirePrivyDid(req);
    return NextResponse.json({ ok: true, ...(await readSupervision(did)), environment: "sportmonks_sandbox" });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(req: Request) {
  try {
    const did = await requirePrivyDid(req);
    const body = await req.json().catch(() => ({}));
    const allowedMarkets = Array.isArray(body.allowedMarkets)
      ? body.allowedMarkets.filter((value: unknown): value is SupervisedMarket => value === "1x2" || value === "goals_ou" || value === "btts")
      : undefined;
    const input: Partial<TradingMandate> = {
      autoExecute: typeof body.autoExecute === "boolean" ? body.autoExecute : undefined,
      paused: typeof body.paused === "boolean" ? body.paused : undefined,
      killed: body.killed === true ? true : undefined,
      maxStake: Number.isFinite(Number(body.maxStake)) ? Number(body.maxStake) : undefined,
      maxDailyStake: Number.isFinite(Number(body.maxDailyStake)) ? Number(body.maxDailyStake) : undefined,
      minEvPct: Number.isFinite(Number(body.minEvPct)) ? Number(body.minEvPct) : undefined,
      maxOddsDriftPct: Number.isFinite(Number(body.maxOddsDriftPct)) ? Number(body.maxOddsDriftPct) : undefined,
      allowedMarkets,
    };
    return NextResponse.json({ ok: true, mandate: await updateMandate(did, input) });
  } catch (error) {
    return failure(error);
  }
}
