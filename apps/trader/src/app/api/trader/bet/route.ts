import { NextResponse } from "next/server";
import { verifyPrivyToken, privyConfigured } from "@/lib/auth/privy-server";
import { placeBet, type Selection, type Market } from "@/lib/trader/betstore";
import { getMarketQuote } from "@/lib/market-data/server";
import { SportmonksTokenMissing } from "@/lib/sportmonks/server";
import { TxlineTokenMissing } from "@/lib/txline/server";

// POST /api/trader/bet — record a live-data simulation position (auth).
// Body: { fixtureId, match, selection, odds, stake, market?, line? }
//   market "1x2" uses home|draw|away, "goals_ou" uses over|under + line, "btts" uses yes|no.
// The browser may show an indicative quote, but it can never choose its execution price.
// We fetch the provider quote again here and persist that server-side quote or reject the order.
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
  const market = (["1x2", "goals_ou", "btts"].includes(body?.market) ? body.market : "1x2") as Market;
  const line = body?.line != null ? Number(body.line) : null;

  const valid = market === "goals_ou"
    ? ["over", "under"].includes(selection) && line != null && Number.isFinite(line)
    : market === "btts" ? ["yes", "no"].includes(selection) : ["home", "draw", "away"].includes(selection);
  if (!Number.isFinite(fixtureId) || !match || !valid) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  try {
    const marketQuote = await getMarketQuote(fixtureId);
    let quote: number | null = null;
    let resolvedLine: number | null = null;
    if (market === "goals_ou") {
      const ou = marketQuote.goalMarkets.find((item) => Math.abs(Number(item.odds.line) - Number(line)) <= 0.001)?.odds ?? null;
      if (!ou || !Number.isFinite(Number(ou.line))) {
        return NextResponse.json({ ok: false, error: "MARKET_UNAVAILABLE" }, { status: 409 });
      }
      resolvedLine = Number(ou.line);
      // Do not silently trade a different totals line than the user accepted.
      if (line == null || Math.abs(line - resolvedLine) > 0.001) {
        return NextResponse.json({ ok: false, error: "QUOTE_CHANGED" }, { status: 409 });
      }
      quote = selection === "over" ? ou.over.dec : ou.under.dec;
    } else if (market === "btts") {
      const btts = marketQuote.btts;
      if (!btts) return NextResponse.json({ ok: false, error: "MARKET_UNAVAILABLE" }, { status: 409 });
      quote = selection === "yes" ? btts.yes.dec : btts.no.dec;
    } else {
      const x = marketQuote.odds;
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
    return NextResponse.json({ ...result, quote: { odds: quote, line: resolvedLine, source: marketQuote.source, bookmaker: marketQuote.bookmaker } });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) return NextResponse.json({ ok: false, error: "TXLINE_API_TOKEN_MISSING" }, { status: 503 });
    if (e instanceof SportmonksTokenMissing) return NextResponse.json({ ok: false, error: "SPORTMONKS_API_TOKEN_MISSING" }, { status: 503 });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
