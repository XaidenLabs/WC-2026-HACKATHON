// TxLINE REST client — dependency-free (Node 18+ global fetch).
// Verified against https://txline-docs.txodds.com (June 2026).
//
// Auth model (CONFIRMED):
//   - POST /auth/guest/start            -> { token }  (the session JWT, "Authorization: Bearer")
//   - To read scores/odds/fixtures data you ALSO need an X-Api-Token, obtained by
//     activating a subscription (free World Cup tier). See 02-subscribe-activate.mjs.
//
// Both headers are required on data endpoints:
//   Authorization: Bearer <sessionJwt>
//   X-Api-Token:   <apiToken>

// DEVNET API host (confirmed by TxODDS support). `txline.txodds.com` routes to MAINNET and
// 504s on a devnet subscribe tx. Guest JWT must also be minted from this devnet host, because
// the activation signed message binds that exact JWT: `${txSig}::${jwt}` (leagues = []).
export const TXLINE_API_BASE = "https://txline-dev.txodds.com";

// ---- Solana program + token addresses (CONFIRMED, devnet) ----
export const TXLINE_PROGRAM_ID_DEVNET = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
export const TXL_MINT_DEVNET = "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG";
export const USDT_MINT_DEVNET = "ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Start a guest session. Returns the session JWT (Authorization: Bearer). */
export async function guestStart() {
  const res = await fetch(`${TXLINE_API_BASE}/auth/guest/start`, { method: "POST" });
  if (!res.ok) throw new Error(`POST /auth/guest/start -> ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json?.token) throw new Error(`guest/start returned no token: ${JSON.stringify(json)}`);
  return json.token;
}

/** @typedef {{ sessionJwt: string, apiToken: string }} TxlineAuth */

function dataHeaders(/** @type {TxlineAuth} */ auth) {
  return {
    Authorization: `Bearer ${auth.sessionJwt}`,
    "X-Api-Token": auth.apiToken,
  };
}

async function getJson(url, auth) {
  const res = await fetch(url, { headers: dataHeaders(auth) });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * GET /api/fixtures/snapshot
 * @param {TxlineAuth} auth
 * @param {{ startEpochDay?: number, competitionId?: number }} [opts]
 * Returns an array of fixtures: { FixtureId, Participant1, Participant2,
 *   Participant1Id, Participant2Id, Participant1IsHome, StartTime, Ts,
 *   Competition, CompetitionId, FixtureGroupId }
 * NOTE: snapshot has NO status field. Use the scores feed phase to detect "finished".
 */
export async function fixturesSnapshot(auth, opts = {}) {
  const qs = new URLSearchParams();
  if (opts.startEpochDay != null) qs.set("startEpochDay", String(opts.startEpochDay));
  if (opts.competitionId != null) qs.set("competitionId", String(opts.competitionId));
  const q = qs.toString();
  return getJson(`${TXLINE_API_BASE}/api/fixtures/snapshot${q ? `?${q}` : ""}`, auth);
}

// ---------------------------------------------------------------------------
// Scores — stat validation proof (the settlement input)
// ---------------------------------------------------------------------------

/**
 * GET /api/scores/stat-validation
 * Required query: fixtureId, seq, statKey   |  Optional: statKey2
 *
 * Response (CONFIRMED shape — these map 1:1 onto the on-chain validate_stat args):
 * {
 *   ts: number,                                  // -> validate_stat arg `ts` (i64)
 *   statToProve:  { key, value, period },        // -> stat_a (StatTerm) [+ statProof]
 *   statToProve2: { key, value, period } | null, // -> stat_b (Option<StatTerm>) [+ statProof2]
 *   summary: {                                   // -> fixture_summary (ScoresBatchSummary)
 *     fixtureId,
 *     updateStats: { updateCount, minTimestamp, maxTimestamp },
 *     eventStatsSubTreeRoot
 *   },
 *   eventStatRoot,
 *   statProof:  ProofNode[],
 *   statProof2: ProofNode[],
 *   subTreeProof:  ProofNode[],                  // -> fixture_proof (Vec<ProofNode>)
 *   mainTreeProof: ProofNode[]                   // -> main_tree_proof (Vec<ProofNode>)
 * }
 *
 * `predicate` (TraderPredicate) and `op` (Option<BinaryExpression>) are NOT returned —
 * we construct those ourselves: they encode the wager terms we are proving.
 *
 * @param {TxlineAuth} auth
 * @param {{ fixtureId: number, seq: number, statKey: number, statKey2?: number }} p
 */
export async function statValidation(auth, p) {
  const qs = new URLSearchParams({
    fixtureId: String(p.fixtureId),
    seq: String(p.seq),
    statKey: String(p.statKey),
  });
  if (p.statKey2 != null) qs.set("statKey2", String(p.statKey2));
  return getJson(`${TXLINE_API_BASE}/api/scores/stat-validation?${qs}`, auth);
}

// Soccer stat keys (from TxLINE soccer-feed). Period 0 = full match.
export const SOCCER_STAT = {
  P1_GOALS: 1, P2_GOALS: 2,
  P1_YELLOW: 3, P2_YELLOW: 4,
  P1_RED: 5, P2_RED: 6,
  P1_CORNERS: 7, P2_CORNERS: 8,
};
