import { NextResponse } from "next/server";
import { verifyPrivyToken, privyConfigured } from "@/lib/auth/privy-server";
import { placeBet, type Selection, type Market } from "@/lib/trader/betstore";
import { getOddsSnapshot, TxlineTokenMissing } from "@/lib/txline/server";
import { parse1X2, parseOU, type TxOddsEntry } from "@/lib/txline/types";

// POST /api/trader/bet — record a live-data simulation position (auth).
// Body: { fixtureId, match, selection, odds, stake, market?, line? }
//   market "1x2" → selection home|draw|away ; market "goals_ou" → selection over|under + line
// The browser may show an indicative quote, but it can never choose its execution price.
// We fetch TxLINE again here and persist that server-side quote or reject the order.
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
  const stake = Number(body?.stake);
  const market = (body?.market === "goals_ou" ? "goals_ou" : "1x2") as Market;
  const line = body?.line != null ? Number(body.line) : null;

  const valid = market === "goals_ou"
    ? ["over", "under"].includes(selection) && line != null && Number.isFinite(line)
    : ["home", "draw", "away"].includes(selection);
  if (!Number.isFinite(fixtureId) || !match || !valid) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  try {
    const raw = (await getOddsSnapshot(fixtureId)) as TxOddsEntry[];
    let quote: number | null = null;
    let resolvedLine: number | null = null;
    if (market === "goals_ou") {
      const ou = parseOU(raw);
      if (!ou || !Number.isFinite(Number(ou.line))) {
        return NextResponse.json({ ok: false, error: "MARKET_UNAVAILABLE" }, { status: 409 });
      }
      resolvedLine = Number(ou.line);
      // Do not silently trade a different totals line than the user accepted.
      if (line == null || Math.abs(line - resolvedLine) > 0.001) {
        return NextResponse.json({ ok: false, error: "QUOTE_CHANGED" }, { status: 409 });
      }
      quote = selection === "over" ? ou.over.dec : ou.under.dec;
    } else {
      const x = parse1X2(raw);
      if (!x) return NextResponse.json({ ok: false, error: "MARKET_UNAVAILABLE" }, { status: 409 });
      quote = selection === "home" ? x.home.dec : selection === "away" ? x.away.dec : x.draw.dec;
    }
    if (!Number.isFinite(quote) || quote == null || quote <= 1) {
      return NextResponse.json({ ok: false, error: "MARKET_UNAVAILABLE" }, { status: 409 });
    }
    const result = await placeBet(did, {
      fixtureId, match, selection, odds: quote, stake, market, line: resolvedLine,
    });
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ...result, quote: { odds: quote, line: resolvedLine, source: "txline" } });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
