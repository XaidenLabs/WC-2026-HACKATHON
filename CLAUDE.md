# WHISTL Protocol — project context

Trustless P2P sports prop-bet escrow + settlement on Solana, for the **World Cup
Hackathon 2026** (Superteam Earn × TxODDS), track **Prediction Markets & Settlement**
($18k). Deadline **2026-07-19**. The user wants to WIN; correctness > scope.

## The one-sentence pitch
Two people wager on a verifiable World Cup stat (e.g. "Brazil corners − Argentina
corners > 3"); funds lock in a PDA escrow; when the match ends, anyone can settle and
our `settle_pact` instruction **CPIs into TxLINE's on-chain `validate_stat`** — winner
paid automatically. No oracle, no admin, no manual resolution.

## Verified technical facts (researched June 2026 — trust these, don't re-derive)
- **TxLINE docs:** https://txline-docs.txodds.com  (index: `/llms.txt`)
- **Devnet program ID:** `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`  (← build/test here)
  - `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` is the **mainnet** program id (what the old
    docx used — not wrong, just mainnet). Mainnet mints: TxL `Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL`, USDT `Es9v…wNYB`.
  - **PDA seeds:** `"pricing_matrix"`, `"token_treasury_v2"`, `"usdt_treasury"`,
    `"daily_scores_roots"` (+ u16 LE epochDay where epochDay = floor(ts_ms / 86400000)),
    `"daily_batch_roots"`, `"ten_daily_fixtures_roots"`.
  - **Free WC subscribe:** `serviceLevelId` = 1 (60s delay) or 12 (real-time); `weeks` = 4;
    activate `leagues` = `[]` (= WC bundle); **0 TxL required**. subscribe `tokenMint` = TxL mint (Token-2022).
- **TXL mint (devnet):** `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG`
- **USDT mint (devnet):** `ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh`
- **`validate_stat`** (the settlement core): returns `bool`; reads ONE account
  `daily_scores_merkle_roots`; discriminator `[107,197,232,90,191,136,105,185]`.
  Args: `ts: i64`, `fixture_summary: ScoresBatchSummary`, `fixture_proof: Vec<ProofNode>`,
  `main_tree_proof: Vec<ProofNode>`, `predicate: TraderPredicate`, `stat_a: StatTerm`,
  `stat_b: Option<StatTerm>`, `op: Option<BinaryExpression>`. Two-stat = stat_a/stat_b/op.
  Sibling instructions: `validate_odds`, `validate_fixture`, `validate_fixture_batch`.
- **Key endpoints:**
  - `POST /auth/guest/start` → `{ token }` (session JWT)
  - `GET /api/fixtures/snapshot?startEpochDay&competitionId` (no status field)
  - `GET /api/scores/stat-validation?fixtureId&seq&statKey[&statKey2]` → proof bundle
  - SSE: `/api/scores/stream`, `/api/odds/stream`
  - Data endpoints need BOTH `Authorization: Bearer <jwt>` AND `X-Api-Token`
    (X-Api-Token comes from activating the free World Cup subscription).
- **Soccer stat keys:** 1/2 goals, 3/4 yellow, 5/6 red, 7/8 corners (P1/P2). Period 0 = full match.

## Environment
- Windows 11. Installed: Node 24, Rust 1.96, cargo, git, yarn.
- NOT installed: Solana CLI, Anchor, avm → **use WSL2** for anything that builds/deploys a program.-----intead use uso its a cli tool @xaidenlabs/uso is the package
- Steps that only call RPC / REST (the de-risk spikes 1–4) run on native Windows Node.

## ⚡ MAJOR FINDING (day 1) — txoracle ALREADY IS the prediction-market protocol
On-chain `txoracle` v1.4.2 already ships a complete trustless P2P prop-bet protocol.
We USE it; we do NOT rebuild it (rebuilding = duplicating the judges' own code, badly).
Both flows settle via the SAME merkle/predicate logic as `validateStat`:

- **Direct 1v1 pact** (= WHISTL's "pact"):
  `createTrade(tradeId, stakeA, stakeB, tradeTermsHash)` — traderA+traderB both sign, both
  stake → `escrowVault`. Then `settleTrade(tradeId, ts, fixtureSummary, fixtureProof,
  mainTreeProof, predicate, statA, statB?, op?)` verifies + pays the winner.
- **Order-book**: `createIntent(intentId, termsHash, depositAmount, expirationTs, claimPeriod,
  fixtureId)` [maker locks deposit] → `executeMatch(tradeId, makerStake, takerStake)` [solver
  pairs two intents → matchedTrade] → `settleMatchedTrade(...)` OR cheap
  `claimViaResolution(epochDay, intervalIndex, merkleProof)` vs published resolution roots.
- `closeIntent` refunds an unmatched intent. Terms are commit-revealed via a 32-byte
  `tradeTermsHash`/`termsHash` — compute client-side from the terms (`marketIntentParams`;
  see the `exposeStructs` ix / docs for the hashing scheme — TODO confirm).
- `validateStat(...) -> bool` is the pure verifier (read-only `.view()` or CPI) — use for
  previews and any custom settlement.

Key arg types (from IDL): `traderPredicate { threshold: i32, comparison: GreaterThan|LessThan|
EqualTo }`; `binaryExpression { add | subtract }`; `statTerm { statToProve: scoreStat{key:u32,
value:i32,period:i32}, eventStatRoot:[u8;32], statProof: Vec<ProofNode> }`;
`scoresBatchSummary { fixtureId:i64, updateStats{updateCount,minTimestamp,maxTimestamp},
eventsSubTreeRoot:[u8;32] }`; `proofNode { hash:[u8;32], isRightSibling:bool }`;
`marketIntentParams { fixtureId, period, statAKey, statBKey?, predicate, op?, negation }`.

Consequence: `validate_stat` is the clean, CPI-able PUBLIC primitive (bool return, 1 account)
TxODDS built for contestants to CPI into. The official track brief EXPLICITLY asks us to write
our OWN settlement engine on top of it (see Strategy), and says judges "highly value" it.
So building our own is the SCORED deliverable, not duplication. txoracle's createTrade/
settleTrade are TxODDS's reference market + a fallback if our engine slips.

## Strategy
**Universal first step (all directions): de-risk the money path.** `derisk/`, Node only —
get X-Api-Token (free WC subscribe+activate) → fetch a real finished-match proof →
`validateStat(...).view()` == true → a real `createTrade`→`settleTrade` round-trip on devnet.
Proving that = the whole thing de-risked.

**Direction (DECIDED — aligned to the official track brief, "Prediction Markets & Settlement",
1st=12k / 2nd=4k / 3rd=2k USDT; close 2026-07-19 23:59 UTC; winners 2026-07-29):**
Build a thin CUSTOM on-chain SETTLEMENT ENGINE that escrows USDC and CPIs `validate_stat` to
release funds. The brief explicitly invites this and says judges "highly value" it. We build
AROUND TxODDS's primitives (their data + validate_stat), NOT from scratch.

Brief constraints baked in:
- Stakes in **USDC / any SPL — NOT TxL** (TxL is locked to data-auth; no P2P with it).
- **"Live OR simulated feeds" accepted** → build a REPLAY mode so the demo shows the full
  create→live→settle→payout flow on a finished match (matches end after the deadline).
- **Demo video weighted HEAVILY** → product experience + user flow + clean deterministic
  resolution code are the scored things. Polish the demo above all.
- OOBE agent = the brief's named **"keeper bot"** that triggers the settlement CPI → strong,
  brief-endorsed differentiator; also resonates with the "Trading Tools & Agents" track.
- Must: TxLINE as primary data source; deployed devnet/mainnet build; public repo; demo video;
  brief technical doc + list of TxLINE endpoints used; API feedback note.

Winning build (in order):
1. De-risk (Node, no WSL2): X-Api-Token → real finished-match proof → `validateStat(...).view()` == true.
2. **Custom Anchor settlement engine (needs WSL2):** `create_bet / accept_bet /
   settle_bet (CPI validate_stat) / cancel`. USDC escrow PDA. Clean, documented, deterministic. ← scored core.
3. Frontend (Next.js): match browser, bet creator (smart pricing from odds), live ticker
   (scores SSE), one-click settle, **PROOF RECEIPT** (= brief's "Verifiable Resolution UI"). + replay mode.
4. OOBE keeper agent: detect finished pacts → auto-settle → store reasoning on-chain.

## Repo layout (planned)
- `derisk/`  — runnable spikes (current focus). Node-only for steps 1–4.
- `programs/whistl/` — OPTIONAL custom Anchor program (direction B only; needs WSL2).
- `app/` — Next.js frontend.
- `agent/` — OOBE/automation (stretch).
- `.superstack/build-context.md` — scaffold/build phase state.

## Naming
Project is **WHISTL** (not "MatchMind" — that was an earlier name, fully retired).

## Current build state (as of 2026-06-25)
- **`app/`** = the REAL frontend: fresh **Next.js 16.2.9 + React 19 + Tailwind v4** (App Router,
  `src/`). ⚠️ Read `app/AGENTS.md` + `app/node_modules/next/dist/docs/` before writing Next code —
  it has breaking changes vs older Next. Route handlers are dynamic by default (good for live data);
  `params`/route context are async; Tailwind v4 is CSS-first (`@import "tailwindcss"` + `@theme`).
- **Real-data layer (built):** `app/src/lib/txline/server.ts` (server-only TxLINE client; mints+caches
  guest JWT, attaches both auth headers) → `app/src/app/api/txline/fixtures/route.ts` proxy. Browser
  calls `/api/txline/*`; token never exposed. Returns `503 TXLINE_TOKEN_MISSING` until token is set.
  Put the token in `app/.env.local` as `TXLINE_API_TOKEN` (copy from derisk/.env once activated).
- **Design:** `app/brand.md` = "Verifiable Terminal" (ink canvas, mono tabular numerics, one lime
  `--signal` accent, proof-receipt hero). NO purple glow / glassmorphism (anti-slop). Landing page done
  + compiles. `npm run dev` in `app/` (currently serves on :3001; old `whistl/app` holds :3000).
- **✅ RESOLVED — real data is LIVE.** The 504s were because we called `txline.txodds.com` (which
  routes to MAINNET) for a DEVNET subscribe tx. **THE FIX — devnet API host = `https://txline-dev.txodds.com`**
  (use it for `/auth/guest/start`, `/api/token/activate`, AND all data endpoints; `txline.txodds.com`
  = mainnet, `oracle-dev.txodds.com` does NOT exist). Free-tier activation: POST `/api/token/activate`
  with `{ txSig, walletSignature, leagues: [] }` + `Authorization: Bearer <devnet guest JWT>`, where
  `walletSignature` = base64 `nacl.sign.detached(`${txSig}::${jwt}`)` (general form
  `${txSig}:${leagues.join(",")}:${jwt}`; empty leagues → `txSig::jwt`). Subscribe tx `5YpGWEXE1B26wEaPh9CGeci…`,
  wallet `35rve1jinPQf4shKZvohQm5ozBqLHhboEZ4BM7vqy52t`. X-Api-Token (`txoracle_api_…`) saved in
  `derisk/.env` AND `app/.env.local`. Both `derisk/lib/txline.mjs` and `app/src/lib/txline/server.ts`
  point at `txline-dev`. Confirmed: `/api/txline/fixtures` returns 23 real WC fixtures (source:live).
  ⚠️ Token may expire — re-run `node derisk/activate.mjs` then re-copy into `app/.env.local` if data 401s.
- **Antigravity scaffolds are SUPERSEDED:** `whistl/app` (Next 12, mock data, broken `anchor.ts` wiring)
  and `agent/` (dead SSE URL `api.txodds.com`, no auth) are NOT the path forward — `app/` replaces the
  frontend. The Anchor program `whistl/programs/whistl` is KEPT.
- **Program vet:** `create_pact`/`accept_pact` are CORRECT (tests pass the 11-arg sig incl. two-stat
  corner-diff). `settle_pact` has bugs to FIX before trusting: (1) `txline_program` not passed into
  `invoke(...)` account_infos + not address-checked → CPI will likely fail; (2) treats `validate_stat==false`
  as "predicate false" when it can also mean "bad proof" → settlement-integrity hole; (3) `escrow_vault`
  not seed-constrained in settle/accept/cancel; (4) `get_return_data().unwrap()` doesn't verify returning prog.
  Program id (devnet): `6jdPJTxGxqgWwL6auCdTP9eoVyiVFXvDBAufMiWJXcP4` — ✅ **DEPLOYED to devnet**
  (deploy tx `5RRt6E4FxLFCJkHHwoF2Xjd7Xzdo4zWV1gmqAvYQEvu8EZWA1vC6Q64J6N8tne3sv7MjhTEriokWv75YLpFQ9Q61`,
  IDL account `2cDvN8T1UrVVVKy3QHcddejYDgqEvBbtGMHLNJwJbK6C`; upgrade-authority wallet
  `35rve1jinPQf4shKZvohQm5ozBqLHhboEZ4BM7vqy52t`, 2.19 SOL remaining). Built/deployed via `uso` (WSL).
  ⚠️ DEPLOY GOTCHA: there's no root workspace Cargo.toml, so `uso build` writes artifacts to
  `whistl/programs/whistl/target/deploy/`, but `uso deploy`/anchor expects `whistl/target/deploy/`.
  Before each deploy, copy `whistl.so` + `whistl-keypair.json` into `whistl/target/deploy/`
  (or add a `[workspace]` Cargo.toml at `whistl/`). Re-sync `declare_id!`/Anchor.toml/env if the
  keypair ever regenerates.
- **✅ SETTLEMENT CORE PROVEN (devnet, `derisk/04-validate-onchain.mjs`):** `validate_stat` verified a
  REAL finished-match Merkle proof and returned correct verdicts (predicate true→true, false→false;
  false ≠ error). The trustless thesis works. **LOAD-BEARING RULES for settle_pact / the settler:**
  - Pass `ts = fixture_summary.updateStats.minTimestamp` (NOT the event `ts`, NOT maxTimestamp — verified).
  - `daily_scores_roots` PDA = `["daily_scores_roots", u16_le(floor(minTimestamp/86_400_000))]`.
  - validate_stat returns the bool via Solana return-data (read base64 `returnData.data[0]`, byte0 != 0).
  - Cost ≈ **5.8k CU** → CPI compute is a non-issue; proof vecs are small → tx-size fine.
  - Proof→arg map (hashes are `u8[32]` number arrays): `fixtureProof`←`subTreeProof`,
    `mainTreeProof`←`mainTreeProof`, `statA`←`{statToProve, eventStatRoot, statProof}`,
    `fixtureSummary.eventsSubTreeRoot`←`summary.eventStatsSubTreeRoot`. (Repro: `03-fetch-proof.mjs`→`04`.)
- **Matches page LIVE** (`/matches`) — 23 real WC fixtures via the proxy.
- **Next:** bet-creator UI (`/pact/new`) → wallet connect → wire create/accept/settle to the program
  (fix `settle_pact`: pass minTimestamp, pass+address-check `txline_program` in the CPI, harden the
  false=bad-proof case) → redeploy via `uso` → keeper agent → demo.

## ⭐ Standout direction — ORA, the verifiable AI counterparty (chosen 2026-06-25)
WHISTL's differentiator: the market's counterparty is a transparent, on-chain AI named **ORA**.
- (1) **Always-on counterparty:** ORA instantly prices a fair line from live TxLINE odds and takes
  the other side of any pact → kills the P2P cold-start/liquidity problem (you can always bet).
- (2) **Glass skull:** every quote/decision/settlement inscribed on-chain via OOBE memory →
  auditable reasoning + verifiable P&L ("Agent Mind" explorer).
- (3) **Self-sustaining x402 economy:** ORA pays per-call (stablecoin) for premium TxLINE data +
  model reasoning (AceDataCloud) via x402; can charge x402 micro-fees. "New in the market" angle.
- Settlement = the PROVEN `validate_stat` CPI. Hits all 3 tracks (Prediction/Settlement, Agents, Fan).
- Stack: OOBE **Synapse** (`synapse-client-sdk`, GitHub `OOBE-PROTOCOL/synapse-client-sdk`) + **x402** +
  **AceDataCloud** (AI API aggregator for ORA's reasoning) + **Privy** (auth/wallet, done).
- Build phases: **P1** pricing brain (odds→fair line+reasoning; UNBLOCKED, demo-able) → **P2** ORA takes
  the counter-side on-chain (needs deployed program + funded ORA wallet + USDC) → **P3** keeper
  auto-settle + OOBE on-chain reasoning → **P4** "Agent Mind" UI + x402 payments.
- ⚠️ synapse.oobeprotocol.ai/docs + platform.acedata.cloud are JS SPAs (WebFetch can't read them);
  confirm exact synapse-client-sdk / x402 / AceDataCloud APIs from the GitHub repos when building.
- ⚠️ Disk hit ENOSPC during npm installs — keep ≥ a few GB free (Anchor/SBF builds are large).
- **P2 foundation DONE (2026-06-25):** P1 pricing brain ✅ (`/api/ora/quote`, wired into the bet creator).
  Devnet **test-USDC mint** `9yMEQEc1zVPW51TaySe228544zkp3BFHWjpQM7qxcGyA` (6 dec; mint authority = the
  derisk wallet `35rve1ji…` so we can faucet freely). **ORA wallet** `21Kkx7CfsPSDjqQaXonWgk8ufFHahZwUn8GU6GFap7xA`
  (secret in derisk/.env `ORA_SECRET_BASE58` + app/.env.local; funded ~0.2 SOL + 100k test-USDC).
  **Program client** `app/src/lib/whistl/program.ts` (deployed IDL at `app/src/lib/whistl/idl.json`,
  PDA helpers, `buildCreatePact`/`buildAcceptPact`) — verified via `/api/whistl/info`. app/.env.local has
  `NEXT_PUBLIC_TEST_USDC_MINT`, `NEXT_PUBLIC_ORA_PUBKEY`, `ORA_SECRET_BASE58`. Anchor libs installed in
  app via `--legacy-peer-deps` (Privy peer-dep conflict otherwise).
  ⚠️ Browser `create_pact` building needs a **Buffer polyfill** (anchor/web3 use Buffer in the browser).
  **P2 LOOP WIRED (compiles ✅, needs browser E2E):** faucet `/api/faucet` (mints test-USDC + sends
  ~0.1 SOL for rent), `create_pact` signed client-side via Privy (`app/src/lib/whistl/client.ts`
  `useWhistlActions`; `useWallets`+`useSignAndSendTransaction` from `@privy-io/react-auth/solana`;
  Buffer polyfill in Providers), ORA `accept_pact` via `/api/ora/accept` (server, `ORA_SECRET_BASE58`,
  only accepts status==0 pacts). Bet creator "Create pact" runs create→ORA-accept; faucet button added.
  ⚠️ The Privy-signed path can't be curl-tested — needs a real browser sign-in. Risk spots if it fails:
  Privy `useWallets()` shape / `wallet.address`, `signAndSendTransaction` legacy-tx acceptance.
  Next: **P3** keeper settle (`settle_pact` via validate_stat, `ts=minTimestamp`) + OOBE on-chain memory.
