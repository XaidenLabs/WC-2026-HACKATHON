import "server-only";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";
import { getFixtures, getScoresSnapshot } from "@/lib/txline/server";
import { parseCurrentScore, type TxFixture, type TxScoreEvent } from "@/lib/txline/types";

// Serverless Telegram broadcaster. ONE poll cycle per call (runTick), so it runs on a Vercel cron
// with no long-running process. Match state and subscribers live in Supabase, namespaced by `bot`
// (whistl / pulse / trader) so the three bots share one database without colliding.
//
// Branding + secrets come from env:
//   TELEGRAM_BOT_TOKEN   the BotFather token for THIS app's bot
//   TELEGRAM_BOT_NAME    "whistl" | "pulse" | "trader"  (namespaces the tables)
//   TELEGRAM_BOT_LABEL   e.g. "WHISTL Live"
//   TELEGRAM_BOT_FOOTER  e.g. "⚖️ Settles on-chain via TxLINE proof"
//   TELEGRAM_CHAT_ID     optional channel/group to also post to

const API = "https://api.telegram.org";

export function botName() { return process.env.TELEGRAM_BOT_NAME || "whistl"; }
export function botConfigured() { return Boolean(process.env.TELEGRAM_BOT_TOKEN) && supabaseConfigured(); }

export async function tg(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "no token" };
  const r = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return r.json() as Promise<{ ok: boolean; error_code?: number; description?: string; result?: unknown }>;
}
export async function sendTo(chatId: number | string, text: string) {
  const res = await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
  return res.ok ? "ok" : res.error_code === 403 ? "blocked" : res.description || "error";
}

// ── subscribers ──────────────────────────────────────────────────────────────
export async function addSub(chatId: number) {
  await supabaseAdmin().from("telegram_subs").upsert({ bot: botName(), chat_id: chatId });
}
export async function removeSub(chatId: number) {
  await supabaseAdmin().from("telegram_subs").delete().eq("bot", botName()).eq("chat_id", chatId);
}
export async function getSubs(): Promise<number[]> {
  const { data } = await supabaseAdmin().from("telegram_subs").select("chat_id").eq("bot", botName());
  return (data ?? []).map((r: { chat_id: number }) => r.chat_id);
}

// ── per-match state ──────────────────────────────────────────────────────────
type MatchState = { g1: number; g2: number; c1: number; c2: number; finished: boolean };
async function getStates(): Promise<Map<number, MatchState>> {
  const { data } = await supabaseAdmin().from("telegram_match_state").select("*").eq("bot", botName());
  const m = new Map<number, MatchState>();
  for (const r of (data ?? []) as (MatchState & { fixture_id: number })[]) {
    m.set(r.fixture_id, { g1: r.g1, g2: r.g2, c1: r.c1, c2: r.c2, finished: r.finished });
  }
  return m;
}
async function saveState(fixtureId: number, s: MatchState) {
  await supabaseAdmin().from("telegram_match_state").upsert({
    bot: botName(), fixture_id: fixtureId, ...s, updated_at: new Date().toISOString(),
  });
}

export function welcomeText() {
  return process.env.TELEGRAM_BOT_WELCOME ||
    `${process.env.TELEGRAM_BOT_LABEL || "Live"}\nYou will get every goal, corner, and scoreline from the World Cup, live from TxLINE. Send /stop to unsubscribe.`;
}

// ── one poll cycle ───────────────────────────────────────────────────────────
export async function runTick() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  if (!supabaseConfigured()) return { ok: false, error: "Supabase not configured" };

  const footer = process.env.TELEGRAM_BOT_FOOTER ? `\n${process.env.TELEGRAM_BOT_FOOTER}` : "";
  const channel = process.env.TELEGRAM_CHAT_ID;

  let subs = await getSubs();
  const targets = [...new Set([...(channel ? [channel] : []), ...subs])];

  let fixtures: TxFixture[];
  try { fixtures = (await getFixtures()) as TxFixture[]; } catch (e) { return { ok: false, error: (e as Error).message }; }
  const now = Date.now();
  const live = fixtures.filter((f) => f.StartTime <= now && now < f.StartTime + 3.5 * 3600e3).slice(0, 15);

  const states = await getStates();
  const broadcast = async (text: string) => {
    for (const chatId of targets) {
      const r = await sendTo(chatId, text);
      if (r === "blocked" && typeof chatId === "number") { await removeSub(chatId); subs = subs.filter((s) => s !== chatId); }
    }
  };

  let checked = 0, changes = 0;
  for (const f of live) {
    let s: ReturnType<typeof parseCurrentScore> = null;
    try { s = parseCurrentScore((await getScoresSnapshot(f.FixtureId)) as TxScoreEvent[]); } catch { continue; }
    if (!s) continue;
    checked++;
    const scoreline = `${f.Participant1} ${s.p1Goals}-${s.p2Goals} ${f.Participant2}`;
    const min = s.clockRunning ? ` · ${s.minutes}'` : "";
    const prev = states.get(f.FixtureId);
    const cur: MatchState = { g1: s.p1Goals, g2: s.p2Goals, c1: s.p1Corners, c2: s.p2Corners, finished: s.isFinished };

    if (!prev) { await saveState(f.FixtureId, cur); continue; } // first sight: record silently

    if (targets.length > 0) {
      if (cur.g1 > prev.g1 || cur.g2 > prev.g2) {
        const who = cur.g1 > prev.g1 ? f.Participant1 : f.Participant2;
        await broadcast(`⚽ <b>GOAL</b>${min}\n${who} score.\n<b>${scoreline}</b>${footer}`); changes++;
      } else if (cur.c1 !== prev.c1 || cur.c2 !== prev.c2) {
        await broadcast(`🚩 <b>CORNER</b>${min}\n${f.Participant1} ${cur.c1}-${cur.c2} ${f.Participant2} (corners)\nScore: ${scoreline}${footer}`); changes++;
      }
      if (cur.finished && !prev.finished) {
        await broadcast(`🏁 <b>FULL TIME</b>\n<b>${scoreline}</b>\nCorners ${cur.c1}-${cur.c2}${footer}`); changes++;
      }
    }
    if (cur.g1 !== prev.g1 || cur.g2 !== prev.g2 || cur.c1 !== prev.c1 || cur.c2 !== prev.c2 || cur.finished !== prev.finished) {
      await saveState(f.FixtureId, cur);
    }
  }
  return { ok: true, bot: botName(), subscribers: subs.length, live: live.length, checked, changes };
}
