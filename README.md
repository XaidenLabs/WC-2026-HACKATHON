<div align="center">

# ⚽ WC-2026-HACKATHON

### The World Cup, settled by math, not by a middleman.

**One backend. Three products. Zero oracles.**
Trustless P2P prop-bet escrow + settlement on Solana, powered by
[**TxODDS**](https://txline-docs.txodds.com) data · [**OOBE Synapse**](https://github.com/OOBE-PROTOCOL) agent memory · [**AceData Cloud**](https://platform.acedata.cloud) reasoning.

<br/>

[![Solana](https://img.shields.io/badge/Solana-Devnet-14F195?style=for-the-badge&logo=solana&logoColor=black)](https://explorer.solana.com/address/BZ2pNdsvpYmeC3dfLKzpKWKqqqKxPBHMPTYr3qVTMRTz?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-Program_Live-512BD4?style=for-the-badge)](https://explorer.solana.com/address/BZ2pNdsvpYmeC3dfLKzpKWKqqqKxPBHMPTYr3qVTMRTz?cluster=devnet)
[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![Track](https://img.shields.io/badge/Track-Prediction_Markets_%26_Settlement-FF5F1F?style=for-the-badge)](#-the-brief-and-why-we-win-it)

**World Cup Hackathon 2026** · Superteam Earn × TxODDS · *Prediction Markets & Settlement* track

</div>

---

> **The one sentence.** Two people wager on a verifiable World Cup stat
> (*"Brazil corners − Argentina corners > 3"*); funds lock in a PDA escrow, and when the match
> ends **anyone** can settle: our on-chain program **CPIs directly into TxODDS's
> `validate_stat`**, reads a Merkle proof of the real result, and pays the winner in the same
> transaction. No oracle. No admin. No manual resolution. **The chain decides.**

---

## 🎯 The 60-second version

Every prediction market has the same rotten center: **someone has to say who won.** An oracle.
An admin key. A multisig. A "trust us." That someone is the attack surface, the censorship
point, and the reason regulators flinch.

WC-2026-HACKATHON removes that someone. TxODDS publishes match results as **Merkle roots on Solana** and
ships a public verifier instruction, `validate_stat`, that returns a plain `bool` for any
staked claim. We built a settlement engine that **calls that verifier over CPI from inside the
payout transaction**, and only releases escrow based on what the verifier returns,
cryptographically proven to have come from TxODDS's own program. Settlement is now a *pure
function of on-chain data.* (Full mechanics: **[apps/whistl](apps/whistl)**.)

Then we did the thing nobody expects at a hackathon: **we shipped it three times**, as three
complete products on one shared backend and one shared contract.

---

## 📦 Three apps, one backend

Each app is a standalone Next.js project with its **own detailed README**. Click through.

| | App | What it is | Who it's for | Port |
|---|---|---|---|---|
| 🟢 | **[apps/whistl](apps/whistl)** | The **protocol**: create pacts, ORA takes the other side, one-click settle with a proof receipt | Everyone. The reference product. | `3000` |
| 🔵 | **[apps/pulse](apps/pulse)** | **WC-2026-HACKATHON Pulse**, the *consumer* PWA. Live AI commentary, push alerts, Hi-Lo, sweepstakes, Agent Mind | Fans who never touch a DEX | `3001` |
| 🟠 | **[apps/trader](apps/trader)** | **TxAgent Desk**, a trading terminal: back ORA's picks, or write a strategy in plain English, backtest it, deploy an agent | Degens & quants | `3000` |

They are **not three codebases**. Everything marked shared below is *identical* across all
three: same ORA wallet, same TxLINE token, same Supabase, same deployed on-chain program.
Three products, one source of truth.

```
whistl-workspace/  (Turborepo + npm workspaces)
│
├── apps/
│   ├── whistl/   🟢  The protocol: pacts, ORA, matches, proof-receipt settlement, keeper
│   ├── pulse/    🔵  Consumer PWA: commentary, sweepstakes, Hi-Lo, push, Agent Mind
│   └── trader/   🟠  TxAgent Desk: NL strategy → backtest → deploy agent
│
├── packages/
│   └── core/     🔗  @whistl/core: shared TxLINE client (mints+caches guest JWT,
│                     attaches both auth headers), shared types. One data layer.
│
├── whistl/programs/whistl/   ⚙️  Anchor settlement engine (Rust): the scored core
│
├── bots/         🤖  Live Telegram bots (WC-2026-HACKATHON · PULSE · TxAgent) broadcasting scores
│
└── derisk/       🔬  Runnable proof spikes (Node): the entire money path, de-risked
```

---

## ✅ Verify us before you read another word

Judges: don't take our word for anything. Click these.

| Thing | Value | Proof |
|---|---|---|
| **WHISTL settlement program** | `BZ2pNdsvpYmeC3dfLKzpKWKqqqKxPBHMPTYr3qVTMRTz` | [🔗 Explorer (devnet, executable)](https://explorer.solana.com/address/BZ2pNdsvpYmeC3dfLKzpKWKqqqKxPBHMPTYr3qVTMRTz?cluster=devnet) |
| **TxODDS `validate_stat` (what we CPI into)** | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` | [🔗 Explorer (devnet)](https://explorer.solana.com/address/6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J?cluster=devnet) |
| **Settlement source (the CPI + proof-provenance check)** | `settle_pact` | [whistl/programs/whistl/src/lib.rs](whistl/programs/whistl/src/lib.rs) |
| **Live TxLINE data proof (real finished match → `true`)** | de-risk spike | [derisk/04-validate-onchain.mjs](derisk/04-validate-onchain.mjs) |

Both programs return `executable: true` on devnet right now. Settlement isn't a diagram; it's
deployed bytecode. **[Read the full settlement walkthrough →](apps/whistl#-how-settlement-actually-works)**

---

## 🤖 ORA, the verifiable AI counterparty

P2P markets die of loneliness: nobody to take the other side. WC-2026-HACKATHON doesn't have that problem,
because the house is an agent named **ORA**, and ORA is made of glass.

- **Always-on liquidity.** ORA prices a fair line from live TxODDS odds (reasoning via
  **AceData Cloud** `gpt-4o-mini`) and instantly takes the counter-side of any pact.
- **Glass skull.** Every quote, decision, and settlement is inscribed on-chain through
  **OOBE Synapse** agent memory → an auditable **Agent Mind** explorer with verifiable P&L.
- **Keeper.** A bot watches for finished pacts and fires the settlement CPI automatically: the
  brief's named *"keeper bot,"* shipped.

ORA is the single differentiator that hits all three hackathon tracks at once: **Prediction &
Settlement**, **Trading Tools & Agents**, and **Fan Engagement**, one per app.

---

## 🧰 Stack

| Layer | Tech |
|---|---|
| **Data** | **TxODDS / TxLINE**: real World Cup fixtures, odds (SSE), scores (SSE), and Merkle stat-validation proofs |
| **Settlement** | **Solana** + **Anchor**: custom escrow engine CPI-ing TxODDS `validate_stat` |
| **AI reasoning** | **AceData Cloud** (`gpt-4o-mini`): ORA's pricing & the NL strategy compiler |
| **Agent memory** | **OOBE Synapse**: on-chain reasoning / "glass skull" |
| **Auth & wallets** | **Privy**: email/social login → embedded Solana wallet, per-user paper bankroll |
| **Persistence** | **Supabase**: pacts, commentary, sweepstakes, push subscriptions |
| **Frontend** | **Next.js 16** · React 19 · Tailwind v4 · App Router · PWA + Web Push |
| **Monorepo** | **Turborepo** + npm workspaces |

Design language: **"Verifiable Terminal"**: ink canvas, mono tabular numerics, a single lime
`--signal` accent, and a proof-receipt hero. Deliberately anti-slop: no purple glow, no
glassmorphism.

---

## 🚀 Run it

**Prereqs:** Node 20+, npm. (Building/deploying the Anchor program needs Solana CLI + Anchor,
or the `uso` CLI, but the apps run against the already-deployed devnet program, so you don't
need them to demo.)

```bash
# 1. install the whole workspace
npm install

# 2. configure env: copy the template into whichever app you want to run
cp apps/whistl/.env.example apps/whistl/.env.local   # protocol
cp apps/pulse/.env.example  apps/pulse/.env.local    # consumer
cp apps/trader/.env.example apps/trader/.env.local   # trading desk
#   → fill in the values (see the Environment table below)

# 3. run one app…
cd apps/whistl && npm run dev        # → http://localhost:3000
cd apps/pulse  && npm run dev        # → http://localhost:3001

# …or everything at once from the root
npm run dev                          # turbo runs all apps
```

Each app's own README covers its routes, features, and key files:
**[whistl](apps/whistl)** · **[pulse](apps/pulse)** · **[trader](apps/trader)**.

### Environment

Every app shares the **same** backend, so the `[shared]` values are identical across all three
`.env.local` files. Public (`NEXT_PUBLIC_*`) values are safe to commit-share; the rest are
secrets.

| Variable | Purpose | Scope |
|---|---|---|
| `TXLINE_API_TOKEN` | TxODDS data auth (from the free WC subscription) | secret · shared |
| `ACE_API_KEY` | AceData Cloud: ORA reasoning + NL strategy compiler | secret · shared |
| `ORA_SECRET_BASE58` | ORA wallet: signs `accept_pact` server-side | secret · shared |
| `MINT_AUTHORITY_SECRET_BASE58` | Mints devnet test-USDC for the faucet | secret · shared |
| `PRIVY_APP_SECRET` | Privy server verification | secret · shared |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase writes | secret · shared |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy client auth | public · shared |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client | public · shared |
| `NEXT_PUBLIC_ORA_PUBKEY` | ORA wallet address | public · shared |
| `NEXT_PUBLIC_SOLANA_RPC` | Devnet RPC (Helius recommended) | public · shared |
| `NEXT_PUBLIC_WHISTL_PROGRAM_ID` | `BZ2pNdsvpYmeC3dfLKzpKWKqqqKxPBHMPTYr3qVTMRTz` | public · shared |
| `NEXT_PUBLIC_TXLINE_PROGRAM_ID` | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` | public · shared |
| `NEXT_PUBLIC_TEST_USDC_MINT` | Devnet test-USDC mint (6 dec) | public · shared |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `NEXT_PRIVATE_VAPID_PRIVATE_KEY` | Web Push (Pulse alerts) via `npx web-push generate-vapid-keys` | Pulse only |

> 🔑 Lost your `.env.local` (new laptop)? Re-activate the free TxLINE token with
> `node derisk/activate.mjs`, then copy the token into each `apps/*/.env.local`. The public
> program IDs and mint are in this table; the ORA/mint/Privy/Supabase secrets come from your
> own accounts.

---

## 🔬 De-risk spikes: the money path, proven end to end

Everything the protocol depends on is proven by a runnable script in [`derisk/`](derisk) before
any UI was written:

| # | Script | Proves |
|---|---|---|
| 01 | [`01-auth.mjs`](derisk/01-auth.mjs) | Guest JWT from `/auth/guest/start` |
| 02 | [`02-subscribe-activate.mjs`](derisk/02-subscribe-activate.mjs) | Free WC subscription → `X-Api-Token` (0 TxL) |
| 03 | [`03-fetch-proof.mjs`](derisk/03-fetch-proof.mjs) | Real finished-match Merkle proof bundle |
| 04 | [`04-validate-onchain.mjs`](derisk/04-validate-onchain.mjs) | **`validate_stat` returns correct verdicts** (predicate true→`true`, false→`false`; `false ≠ error`) |

**Result:** the trustless thesis holds. `validate_stat` verified a *real* World Cup match proof
on devnet and returned the right answer. Settlement was de-risked before it was built.

---

## 🌐 TxLINE endpoints we use *(required deliverable)*

Devnet host: **`https://txline-dev.txodds.com`** (mainnet is `txline.txodds.com`).

| Endpoint | Use |
|---|---|
| `POST /auth/guest/start` | Session JWT |
| `POST /api/token/activate` | Activate free WC subscription → `X-Api-Token` |
| `GET /api/fixtures/snapshot` | World Cup fixtures |
| `GET /api/scores/stat-validation` | The Merkle proof bundle that settles a pact |
| `GET /api/odds/*` | Odds → ORA's fair-line pricing |
| `SSE /api/scores/stream` · `SSE /api/odds/stream` | Live scores & odds tickers |

Data calls carry **both** `Authorization: Bearer <jwt>` **and** `X-Api-Token`. Our shared
[`@whistl/core`](packages/core/src/txline/server.ts) client mints + caches the JWT and attaches
both headers, so the browser only ever hits our `/api/txline/*` proxy, and the token is never
exposed.

---

## 🏆 The brief, and why we win it

*Prediction Markets & Settlement · 1st: 12k / 2nd: 4k / 3rd: 2k USDT*

| The brief asks for… | What we shipped |
|---|---|
| A custom settlement engine on top of TxLINE | ✅ Hardened Anchor program CPI-ing `validate_stat`, deployed & executable on devnet |
| TxLINE as the **primary** data source | ✅ Fixtures, odds, scores, and proofs, all TxODDS, one shared client |
| Deterministic, clean resolution code | ✅ Settlement is a pure function of on-chain Merkle data; provenance-checked; ~5.8k CU |
| A "Verifiable Resolution UI" | ✅ The **proof receipt**: every settlement shows the proof that decided it |
| A keeper bot | ✅ ORA's OOBE keeper auto-settles finished pacts |
| Live **or simulated** feeds accepted | ✅ Replay mode demos the full create→live→settle→payout flow on finished matches |
| Public repo · deployed build · demo video · endpoint list · API feedback | ✅ / ✅ / 🎥 / ☝️ / 📝 |

We didn't rebuild the judges' protocol. We built the **product experience** and the
**settlement engine** the brief explicitly invites, around TxODDS's primitives, three times,
for three different humans.

---

<div align="center">

**WC-2026-HACKATHON** · *the whistle blows, the chain decides.*

Built for the World Cup Hackathon 2026 · Superteam Earn × TxODDS
Data by [TxODDS](https://txline-docs.txodds.com) · Agent memory by [OOBE](https://github.com/OOBE-PROTOCOL) · Reasoning by [AceData Cloud](https://platform.acedata.cloud)

</div>
