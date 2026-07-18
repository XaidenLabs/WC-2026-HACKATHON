import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { devnetConnection } from "@/lib/whistl/server";

// ORA's Mind — its ENTIRE on-chain life in one feed. ORA signs both Pulse match commentary
// (ORA·WHISTL memos) and TxAgent trade calls (TxAGENT memos) with the same wallet, so reading
// its memo history gives a unified, tamper-proof record of everything the agent thinks + does.

type MindEntry = {
  kind: "commentary" | "trade";
  title: string; // headline (commentary) or "Bet on Home @ 1.85" (trade)
  body: string; // analysis / reasoning
  tag: string; // match label or "WC#id"
  timestamp: number;
  signature: string;
  explorerUrl: string;
};

const SEL: Record<string, string> = { HOME: "Home", DRAW: "the Draw", AWAY: "Away" };

function explorerUrl(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function parse(raw: string, sig: string, blockTime: number | null | undefined): MindEntry | null {
  const text = raw.replace(/^\[\d+\]\s*/, "");
  const base = { timestamp: (blockTime ?? 0) * 1000, signature: sig, explorerUrl: explorerUrl(sig) };

  if (text.startsWith("ORA·WHISTL")) {
    const parts = text.split(" | ");
    if (parts.length < 4) return null;
    const rest = parts.slice(3).join(" | ").split(" || MKT: ")[0];
    const dash = rest.indexOf(" · ");
    const headline = (dash >= 0 ? rest.slice(0, dash) : rest).trim();
    const analysis = dash >= 0 ? rest.slice(dash + 3).trim() : "";
    return { kind: "commentary", title: headline, body: analysis, tag: parts[1].trim(), ...base };
  }

  if (text.startsWith("TxAGENT")) {
    const parts = text.split(" | ");
    if (parts.length < 5) return null;
    const bet = parts[3].match(/^(BACK|LAY)\s+(HOME|DRAW|AWAY)\s+@\s+([\d.]+)$/);
    if (!bet) return null;
    let reasoning = parts.slice(4);
    if (reasoning[reasoning.length - 1]?.match(/^FX#\d+$/)) reasoning = reasoning.slice(0, -1);
    const verb = bet[1] === "BACK" ? "Bet on" : "Bet against";
    return {
      kind: "trade",
      title: `${verb} ${SEL[bet[2]]} @ ${Number(bet[3]).toFixed(2)}×`,
      body: reasoning.join(" | ").trim(),
      tag: parts[2].trim(),
      ...base,
    };
  }

  return null;
}

export async function GET() {
  try {
    const pk = process.env.NEXT_PUBLIC_ORA_PUBKEY;
    if (!pk) return NextResponse.json({ ok: false, error: "ORA_PUBKEY_MISSING" }, { status: 503 });

    const conn = devnetConnection();
    const sigs = await conn.getSignaturesForAddress(new PublicKey(pk), { limit: 100 });

    const entries = sigs
      .filter((s) => s.memo && !s.err)
      .map((s) => parse(s.memo as string, s.signature, s.blockTime))
      .filter((e): e is MindEntry => e !== null)
      .sort((a, b) => b.timestamp - a.timestamp);

    const stats = {
      total: entries.length,
      commentary: entries.filter((e) => e.kind === "commentary").length,
      trades: entries.filter((e) => e.kind === "trade").length,
    };

    return NextResponse.json({ ok: true, entries, stats });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
