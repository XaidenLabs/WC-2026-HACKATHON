import "server-only";
// Server-only TxLINE client. Holds the API token + session JWT on the server so the
// browser never sees them. Used by the /api/txline/* route handlers.
//
// Data endpoints require BOTH headers:
//   Authorization: Bearer <guest session JWT>   (POST /auth/guest/start, ~30d)
//   X-Api-Token:   <activated API token>        (env TXLINE_API_TOKEN)

import type { TxFixture, StatValidation } from "./types";

// Devnet API host (confirmed by TxODDS). `txline.txodds.com` routes to mainnet.
const BASE = "https://txline-dev.txodds.com";

/** Raised when TXLINE_API_TOKEN is not configured — routes turn this into a 503. */
export class TxlineTokenMissing extends Error {
  constructor() {
    super("TXLINE_API_TOKEN is not set");
    this.name = "TxlineTokenMissing";
  }
}

// Cache the guest JWT in module memory (valid ~30d; refresh hourly to be safe).
let jwtCache: { token: string; at: number } | null = null;
async function getJwt(): Promise<string> {
  if (jwtCache && Date.now() - jwtCache.at < 60 * 60 * 1000) return jwtCache.token;
  const res = await fetch(`${BASE}/auth/guest/start`, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error(`POST /auth/guest/start -> ${res.status}`);
  const json = (await res.json()) as { token?: string };
  if (!json.token) throw new Error("guest/start returned no token");
  jwtCache = { token: json.token, at: Date.now() };
  return json.token;
}

async function txGet<T>(path: string): Promise<T> {
  const apiToken = process.env.TXLINE_API_TOKEN;
  if (!apiToken) throw new TxlineTokenMissing();
  const jwt = await getJwt();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`GET ${path} -> ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

/** GET /api/fixtures/snapshot — all upcoming/recent fixtures.
 *  TxLINE defaults startEpochDay to "today", so ended matches from prior days
 *  vanish. We default to 3 days back to keep recently ended matches visible. */
export function getFixtures(opts: { startEpochDay?: number; competitionId?: number } = {}) {
  const qs = new URLSearchParams();
  // Epoch day = floor(ms-since-epoch / 86_400_000)
  const defaultEpochDay = Math.floor(Date.now() / 86_400_000) - 3;
  qs.set("startEpochDay", String(opts.startEpochDay ?? defaultEpochDay));
  if (opts.competitionId != null) qs.set("competitionId", String(opts.competitionId));
  const q = qs.toString();
  return txGet<TxFixture[]>(`/api/fixtures/snapshot${q ? `?${q}` : ""}`);
}

/** GET /api/scores/snapshot/{fixtureId} — latest score event per action for a fixture. */
export function getScoresSnapshot(fixtureId: number) {
  return txGet<unknown[]>(`/api/scores/snapshot/${fixtureId}`);
}

/** GET /api/scores/historical/{fixtureId} — full sequence of score updates (2 weeks → 6h past). */
export function getScoresHistorical(fixtureId: number) {
  return txGet<unknown[]>(`/api/scores/historical/${fixtureId}`);
}

/** GET /api/scores/stat-validation — the 3-stage Merkle proof for a stat (settlement input). */
export function getStatValidation(p: {
  fixtureId: number;
  seq: number;
  statKey: number;
  statKey2?: number;
}) {
  const qs = new URLSearchParams({
    fixtureId: String(p.fixtureId),
    seq: String(p.seq),
    statKey: String(p.statKey),
  });
  if (p.statKey2 != null) qs.set("statKey2", String(p.statKey2));
  return txGet<StatValidation>(`/api/scores/stat-validation?${qs}`);
}

/** GET /api/odds/snapshot/{fixtureId} — current odds (each payload carries pre-computed Pct[]). */
export function getOddsSnapshot(fixtureId: number, asOf?: number) {
  const q = asOf != null ? `?asOf=${asOf}` : "";
  return txGet<unknown[]>(`/api/odds/snapshot/${fixtureId}${q}`);
}
