// Shared core for the WHISTL / PULSE / TxAgent Telegram bots.
// Polls TxLINE live scores and broadcasts goals, corners, and scorelines to Telegram.
// No external dependencies (Node 18+ global fetch). Each app's bot is a thin launcher
// that calls run(config) with its own branding + bot token.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TXLINE_BASE = "https://txline-dev.txodds.com";

// ── tiny .env loader (bots/.env) ────────────────────────────────────────────
export function loadEnv() {
  const p = path.join(__dirname, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).split(" #")[0].trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

// ── TxLINE client ───────────────────────────────────────────────────────────
let jwtCache = { token: null, at: 0 };
async function guestJwt() {
  if (jwtCache.token && Date.now() - jwtCache.at < 30 * 60_000) return jwtCache.token;
  const r = await fetch(`${TXLINE_BASE}/auth/guest/start`, { method: "POST" });
  const j = await r.json();
  if (!j?.token) throw new Error("guest/start returned no token");
  jwtCache = { token: j.token, at: Date.now() };
  return j.token;
}
async function txGet(pathname, apiToken) {
  const jwt = await guestJwt();
  const r = await fetch(`${TXLINE_BASE}${pathname}`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`GET ${pathname} -> ${r.status}`);
  return r.json();
}
export async function fixturesSnapshot(apiToken) {
  const epochDay = Math.floor(Date.now() / 86_400_000) - 1;
  return txGet(`/api/fixtures/snapshot?startEpochDay=${epochDay}`, apiToken);
}
export async function scoresSnapshot(apiToken, fixtureId) {
  return txGet(`/api/scores/snapshot/${fixtureId}`, apiToken);
}

/** Parse the current scoreline + corners from a scores snapshot (mirrors the app's logic). */
export function parseScore(events) {
  if (!Array.isArray(events) || !events.length) return null;
  const withScore = events.filter((e) => e.Score?.Participant1?.Total || e.Score?.Participant2?.Total);
  if (!withScore.length) return null;
  const latest = withScore.reduce((a, b) => (b.Seq > a.Seq ? b : a));
  const p1 = latest.Score?.Participant1?.Total ?? {};
  const p2 = latest.Score?.Participant2?.Total ?? {};
  const clockRunning = latest.Clock?.Running ?? false;
  return {
    g1: p1.Goals ?? 0, g2: p2.Goals ?? 0,
    c1: p1.Corners ?? 0, c2: p2.Corners ?? 0,
    minutes: Math.floor((latest.Clock?.Seconds ?? 0) / 60),
    clockRunning,
    isFinished: latest.StatusId != null && latest.StatusId >= 100, // 100 = terminal 'finished'; lower incl. HT/ET/pens breaks
  };
}

// ── Telegram ────────────────────────────────────────────────────────────────
async function tg(method, botToken, body) {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}
async function sendTo(botToken, chatId, text) {
  const res = await tg("sendMessage", botToken, { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
  if (!res.ok && res.error_code === 403) return "blocked"; // user blocked the bot
  return res.ok ? "ok" : res.description || "error";
}

// ── subscriber persistence (chat ids that /start-ed the bot) ─────────────────
function subsPath(name) { return path.join(__dirname, `.subs-${name}.json`); }
function loadSubs(name) { try { return JSON.parse(fs.readFileSync(subsPath(name), "utf8")); } catch { return []; } }
function saveSubs(name, subs) { fs.writeFileSync(subsPath(name), JSON.stringify([...new Set(subs)])); }

// ── the bot ─────────────────────────────────────────────────────────────────
/**
 * config = {
 *   name: "whistl" | "pulse" | "trader",
 *   label: "WHISTL Live",
 *   emoji: "⚖️",
 *   botToken: string,
 *   apiToken: string (TxLINE),
 *   channelId?: string (optional fixed channel to also post to),
 *   welcome: string,
 *   footer: (f) => string,   // per-event footer line
 *   pollMs?: number,
 * }
 */
export async function run(config) {
  const { name, label, emoji, botToken, apiToken, channelId, welcome, footer, pollMs = 40_000 } = config;
  if (!botToken) throw new Error(`Missing bot token for ${name}. Set it in bots/.env`);
  if (!apiToken) throw new Error("Missing TXLINE_API_TOKEN in bots/.env");

  const state = new Map(); // fixtureId -> { g1,g2,c1,c2, finished, name }
  let subs = loadSubs(name);
  let updateOffset = 0;

  const targets = () => [...new Set([...(channelId ? [channelId] : []), ...subs])];
  async function broadcast(text) {
    for (const chatId of targets()) {
      const r = await sendTo(botToken, chatId, text);
      if (r === "blocked") subs = subs.filter((s) => String(s) !== String(chatId));
    }
    saveSubs(name, subs);
  }

  // Handle /start and /stop so anyone can DM the bot to subscribe.
  async function pollUpdates() {
    try {
      const res = await tg("getUpdates", botToken, { offset: updateOffset, timeout: 0 });
      if (!res.ok) return;
      for (const u of res.result) {
        updateOffset = u.update_id + 1;
        const msg = u.message;
        if (!msg?.text) continue;
        const chatId = msg.chat.id;
        const cmd = msg.text.trim().toLowerCase();
        if (cmd.startsWith("/start")) {
          if (!subs.map(String).includes(String(chatId))) subs.push(chatId);
          saveSubs(name, subs);
          await sendTo(botToken, chatId, welcome);
          console.log(`[${name}] new subscriber ${chatId} (total ${subs.length})`);
        } else if (cmd.startsWith("/stop")) {
          subs = subs.filter((s) => String(s) !== String(chatId));
          saveSubs(name, subs);
          await sendTo(botToken, chatId, "You will no longer receive live updates. Send /start to resubscribe.");
        }
      }
    } catch (e) { console.error(`[${name}] updates error:`, e.message); }
  }

  async function pollScores() {
    let fixtures;
    try { fixtures = await fixturesSnapshot(apiToken); } catch (e) { console.error(`[${name}] fixtures error:`, e.message); return; }
    const now = Date.now();
    const live = (fixtures || []).filter((f) => f.StartTime <= now && now < f.StartTime + 3.5 * 3600e3);

    for (const f of live) {
      let s;
      try { s = parseScore(await scoresSnapshot(apiToken, f.FixtureId)); } catch { continue; }
      if (!s) continue;
      const label2 = `${f.Participant1} ${s.g1}-${s.g2} ${f.Participant2}`;
      const prev = state.get(f.FixtureId);
      const foot = footer ? `\n${footer(f)}` : "";
      const min = s.clockRunning ? ` · ${s.minutes}'` : "";

      if (!prev) {
        // First sight: record silently so we do not spam every in-progress match on startup.
        state.set(f.FixtureId, { g1: s.g1, g2: s.g2, c1: s.c1, c2: s.c2, finished: s.isFinished });
        continue;
      }

      if (s.g1 > prev.g1 || s.g2 > prev.g2) {
        const who = s.g1 > prev.g1 ? f.Participant1 : f.Participant2;
        await broadcast(`⚽ <b>GOAL</b>${min}\n${who} score.\n<b>${label2}</b>${foot}`);
      } else if (s.c1 !== prev.c1 || s.c2 !== prev.c2) {
        await broadcast(`🚩 <b>CORNER</b>${min}\n${f.Participant1} ${s.c1}-${s.c2} ${f.Participant2} (corners)\nScore: ${label2}${foot}`);
      }

      if (s.isFinished && !prev.finished) {
        await broadcast(`🏁 <b>FULL TIME</b>\n<b>${label2}</b>\nCorners ${s.c1}-${s.c2}${foot}`);
      }

      state.set(f.FixtureId, { g1: s.g1, g2: s.g2, c1: s.c1, c2: s.c2, finished: s.isFinished });
    }
  }

  console.log(`${emoji} ${label} bot online. Broadcasting live scores, corners, and scorelines from TxLINE.`);
  console.log(`   Subscribers: ${subs.length}${channelId ? ` + channel ${channelId}` : ""}. Poll every ${pollMs / 1000}s.`);
  console.log(`   DM the bot /start to subscribe.`);

  // getUpdates loop (fast) + scores loop (slower), independent.
  setInterval(pollUpdates, 3_000);
  await pollUpdates();
  await pollScores();
  setInterval(pollScores, pollMs);
}
