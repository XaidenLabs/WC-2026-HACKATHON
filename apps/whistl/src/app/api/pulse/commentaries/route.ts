import { NextResponse } from "next/server";
import { devnetConnection, nodeWallet, oraKeypair } from "@/lib/whistl/server";
import { getProgram, fixtureMetaPda, commentaryEntryPda } from "@/lib/whistl/program";
import type { CommentaryCard } from "@/lib/pulse/commentary";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fixtureId = Number(searchParams.get("fixtureId"));
  if (!Number.isFinite(fixtureId)) {
    return NextResponse.json({ ok: false, error: "BAD_FIXTURE_ID" }, { status: 400 });
  }

  try {
    const conn = devnetConnection();
    // Use an ephemeral keypair just to satisfy the AnchorProvider signature interface (reads don't need a real signer)
    const program = getProgram(conn, nodeWallet(oraKeypair()));

    const metaPda = fixtureMetaPda(fixtureId);
    let count = 0;
    try {
      const meta = await (program.account as any).fixtureMeta.fetch(metaPda);
      count = Number(meta.count.toString());
    } catch {
      // no commentaries yet
      return NextResponse.json({ ok: true, commentaries: [] });
    }

    // Fetch all entries. We can do it in parallel.
    const pdaPromises = Array.from({ length: count }).map((_, i) => commentaryEntryPda(fixtureId, i));
    const accounts = await (program.account as any).commentaryEntry.fetchMultiple(pdaPromises);

    const commentaries = accounts
      .filter((a: any): a is NonNullable<typeof a> => a !== null)
      .map((a: any) => ({
        headline: a.headline,
        analysis: a.analysis,
        market: a.market,
        source: a.source as CommentaryCard["source"],
        timestamp: Number(a.timestamp.toString()),
      }))
      .sort((a: any, b: any) => b.timestamp - a.timestamp); // Newest first

    return NextResponse.json({ ok: true, commentaries });
  } catch (e) {
    console.error("[api/pulse/commentaries]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
