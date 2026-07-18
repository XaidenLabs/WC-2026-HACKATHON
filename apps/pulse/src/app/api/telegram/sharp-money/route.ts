import { NextResponse } from "next/server";
import { getSubs, sendTo } from "@/lib/telegram/server";
import { getFixtures } from "@/lib/txline/server";
import { matchPhase } from "@/lib/pulse/format";
import { detectSharpMoves, type SharpAlert } from "@/lib/pulse/sharp";
import { aceChat } from "@/lib/ace/client";
import { type TxFixture } from "@/lib/txline/types";

const MIN = 60 * 1000;
const HR = 60 * MIN;
const LIVE_SAMPLES = [10 * MIN, 30 * MIN, 90 * MIN];
const PREMATCH_SAMPLES = [3 * HR, 9 * HR, 24 * HR];
const MAX_SCAN = 8;

export async function GET() {
  const fixtures = (await getFixtures({
    startEpochDay: Math.floor(Date.now() / 86_400_000) - 14,
  })) as TxFixture[];
  const now = Date.now();

  const live = fixtures.filter((f) => matchPhase(f.StartTime, now) === "live");
  const upcoming = fixtures
    .filter((f) => matchPhase(f.StartTime, now) === "upcoming")
    .sort((a, b) => a.StartTime - b.StartTime);

  const scan = [...live, ...upcoming].slice(0, MAX_SCAN);

  const batches = await Promise.all(
    scan.map(async (f) => {
      const isLive = matchPhase(f.StartTime, now) === "live";
      const samples = (isLive ? LIVE_SAMPLES : PREMATCH_SAMPLES).map((dt) => now - dt);
      try {
        return await detectSharpMoves({
          fixtureId: f.FixtureId,
          p1: f.Participant1,
          p2: f.Participant2,
          competition: f.Competition,
          phase: isLive ? "live" : "upcoming",
          asOfList: samples,
        });
      } catch {
        return [] as SharpAlert[];
      }
    }),
  );

  const moves = batches.flat().sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));
  const topMove = moves[0];

  if (!topMove) {
    return NextResponse.json({ ok: false, error: "No odds data found to generate alert" });
  }

  const prompt = `Write a short, punchy Telegram alert (HTML parsed) for a massive sports betting sharp money move.
The data is:
Match: ${topMove.match}
Market: ${topMove.market}
Headline: ${topMove.headline}
Shift: ${topMove.shift > 0 ? "+" : ""}${topMove.shift} percentage points swing!
Current implied probability: ${topMove.toPct}%

Make it sound like an exclusive insider alert for sharp bettors. Use emojis like 💸, 🚨, or 📈. Keep it under 4 sentences. 
Do not include any greeting.
End with this exact footer:
<a href="https://pulse-khaki-omega.vercel.app/alerts">Verify on-chain via TxLINE</a>`;

  let alertText = "";
  try {
    alertText = await aceChat([
      { role: "system", content: "You are an elite sports betting analyst bot." },
      { role: "user", content: prompt }
    ]);
  } catch (e) {
    // Fallback if LLM fails
    alertText = `💸 <b>SHARP MONEY ALERT</b>\n\n🚨 Massive line movement detected on <b>${topMove.match}</b>!\n${topMove.headline} (${topMove.shift > 0 ? "+" : ""}${topMove.shift}pp shift to ${topMove.toPct}%).\n\n<a href="https://pulse-khaki-omega.vercel.app/alerts">Verify on-chain via TxLINE</a>`;
  }

  const subs = await getSubs();
  let sent = 0;
  for (const sub of subs) {
    await sendTo(sub, alertText);
    sent++;
  }
  
  return NextResponse.json({ ok: true, sent, topMove, alertText });
}
