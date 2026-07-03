import { NextResponse } from "next/server";
import { verifyPrivyToken, privyConfigured } from "@/lib/auth/privy-server";
import { placeBet, type Selection } from "@/lib/trader/betstore";

// POST /api/trader/bet — place a paper bet (auth). Body: { fixtureId, match, selection, odds, stake }
export async function POST(req: Request) {
  if (!privyConfigured()) return NextResponse.json({ ok: false, error: "AUTH_NOT_CONFIGURED" }, { status: 503 });

  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  let did: string;
  try {
    did = await verifyPrivyToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const fixtureId = Number(body?.fixtureId);
  const match = String(body?.match ?? "").slice(0, 80);
  const selection = body?.selection as Selection;
  const odds = Number(body?.odds);
  const stake = Number(body?.stake);

  if (!Number.isFinite(fixtureId) || !match || !["home", "draw", "away"].includes(selection)) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const result = await placeBet(did, { fixtureId, match, selection, odds, stake });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
