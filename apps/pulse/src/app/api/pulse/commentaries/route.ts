import { NextResponse } from "next/server";
import { devnetConnection, oraKeypair } from "@/lib/whistl/server";

// Reads ORA's commentary feed straight from Solana — its on-chain memo history — so there is
// no database and no in-memory state to lose. Fully decentralised + serverless-safe.

type ParsedMemo = {
  fixtureId: number;
  source: "ace" | "template";
  headline: string;
  analysis: string;
  market: string;
};

// Parse a memo of the form:
//   [len] ORA·WHISTL | WC#<id> | <SOURCE> | <headline> — <analysis> || MKT: <market>
function parseMemo(raw: string): ParsedMemo | null {
  const text = raw.replace(/^\[\d+\]\s*/, ""); // strip the "[len] " prefix the RPC adds
  if (!text.startsWith("ORA·WHISTL")) return null;

  const parts = text.split(" | ");
  if (parts.length < 4) return null;

  const fx = parts[1].match(/WC#(\d+)/);
  if (!fx) return null;

  const source = parts[2].trim().toLowerCase() === "ace" ? "ace" : "template";

  let rest = parts.slice(3).join(" | ");
  let market = "";
  const mkt = rest.split(" || MKT: ");
  if (mkt.length > 1) {
    rest = mkt[0];
    market = mkt.slice(1).join(" || MKT: ");
  }

  const dash = rest.indexOf(" — ");
  const headline = (dash >= 0 ? rest.slice(0, dash) : rest).trim();
  const analysis = dash >= 0 ? rest.slice(dash + 3).trim() : "";

  return { fixtureId: Number(fx[1]), source, headline, analysis, market };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fixtureId = Number(searchParams.get("fixtureId"));
  if (!Number.isFinite(fixtureId)) {
    return NextResponse.json({ ok: false, error: "BAD_FIXTURE_ID" }, { status: 400 });
  }

  try {
    const conn = devnetConnection();
    const ora = oraKeypair().publicKey;

    // One RPC call returns recent signatures WITH their memo text + block time.
    const sigs = await conn.getSignaturesForAddress(ora, { limit: 100 });

    const commentaries = sigs
      .filter((s) => s.memo && !s.err)
      .map((s) => ({ parsed: parseMemo(s.memo as string), sig: s.signature, blockTime: s.blockTime }))
      .filter((x) => x.parsed && x.parsed.fixtureId === fixtureId)
      .map((x) => ({
        headline: x.parsed!.headline,
        analysis: x.parsed!.analysis,
        market: x.parsed!.market,
        source: x.parsed!.source,
        timestamp: (x.blockTime ?? 0) * 1000,
        signature: x.sig,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ ok: true, commentaries });
  } catch (e) {
    console.error("[api/pulse/commentaries]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
