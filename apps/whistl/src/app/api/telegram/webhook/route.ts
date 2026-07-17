import { NextResponse } from "next/server";
import { addSub, removeSub, welcomeText, sendTo } from "@/lib/telegram/server";

// POST /api/telegram/webhook — Telegram calls this whenever a user messages the bot. We handle
// /start (subscribe) and /stop (unsubscribe). Always return 200 so Telegram does not retry.
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const update = await req.json().catch(() => ({}));
    const msg = update?.message;
    const text: string = msg?.text || "";
    const chatId: number | undefined = msg?.chat?.id;
    if (chatId && text) {
      const cmd = text.trim().toLowerCase();
      if (cmd.startsWith("/start")) {
        await addSub(chatId);
        await sendTo(chatId, welcomeText());
      } else if (cmd.startsWith("/stop")) {
        await removeSub(chatId);
        await sendTo(chatId, "You will no longer receive live updates. Send /start to resume.");
      }
    }
  } catch { /* ignore malformed updates */ }
  return NextResponse.json({ ok: true });
}
