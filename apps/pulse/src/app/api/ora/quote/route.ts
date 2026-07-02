import { NextResponse } from "next/server";
import { getOddsSnapshot } from "@/lib/txline/server";
import { priceQuote, type PactTerms, type MarketContext } from "@/lib/ora/pricer";
import { parse1X2, parseOU, type TxOddsEntry } from "@/lib/txline/types";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const fixtureId = Number(body?.fixtureId);
  const terms = body?.terms as PactTerms | undefined;
  if (!terms || !Number.isFinite(fixtureId)) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  let marketCtx: MarketContext = {};
  try {
    const odds = (await getOddsSnapshot(fixtureId)) as TxOddsEntry[];
    if (Array.isArray(odds)) {
      const x12 = parse1X2(odds);
      const ou = parseOU(odds);
      marketCtx = {
        x12: x12 ?? undefined,
        ou: ou ?? undefined,
      };
    }
  } catch {
    // non-blocking — fall back to model
  }

  const quote = priceQuote(terms, marketCtx);
  return NextResponse.json({ ok: true, quote });
}
