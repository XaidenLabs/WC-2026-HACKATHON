import { NextResponse } from "next/server";
import { tg } from "@/lib/telegram/server";

// GET /api/telegram/setup?secret=CRON_SECRET — one-time. Points Telegram at this deployment's
// webhook so /start and /stop work, and registers the bot's command menu. Run it once after deploy.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  if (secret && url.searchParams.get("secret") !== secret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED (pass ?secret=CRON_SECRET)" }, { status: 401 });
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN_NOT_CONFIGURED" }, { status: 503 });
  }
  const base = process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;
  const webhook = `${base}/api/telegram/webhook`;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const set = await tg("setWebhook", {
    url: webhook,
    allowed_updates: ["message"],
    ...(webhookSecret ? { secret_token: webhookSecret } : {}),
  });
  const commands = await tg("setMyCommands", {
    commands: [
      { command: "start", description: "Get live goals, corners and scorelines" },
      { command: "stop", description: "Stop live updates" },
    ],
  });
  return NextResponse.json({ ok: set.ok && commands.ok, webhook, telegram: set, commands });
}
