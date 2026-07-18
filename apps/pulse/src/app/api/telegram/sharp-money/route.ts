import { NextResponse } from "next/server";
import { getSubs, sendTo } from "@/lib/telegram/server";

export async function GET() {
  const subs = await getSubs();
  let sent = 0;
  for (const sub of subs) {
    await sendTo(
      sub,
      "💸 <b>SHARP MONEY ALERT</b>\n\nMassive $12,500 USDC volume detected on <b>Brazil vs Argentina</b>!\nMarket shifted heavily to <b>Brazil Win</b>\n\n⚖️ Settles on-chain via TxLINE proof"
    );
    sent++;
  }
  return NextResponse.json({ ok: true, sent });
}
