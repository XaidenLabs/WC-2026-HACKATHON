<div align="center">

# 🔵 WHISTL Pulse: your AI football companion

### What if your phone knew more about the match than the commentator did?

The *consumer* face of the [WHISTL monorepo](../../README.md): a mobile-first PWA that turns
the same trustless protocol into something a fan who's never touched a DEX actually wants to
open. Live AI market-intelligence commentary, instant push alerts, one-tap games, and a
glass-box view into ORA's mind, all powered by real-time TxLINE match data.

[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![PWA](https://img.shields.io/badge/PWA-Web_Push-C6F24E?style=for-the-badge)](https://developer.mozilla.org/docs/Web/Progressive_web_apps)
[![Solana](https://img.shields.io/badge/Solana-Devnet-14F195?style=for-the-badge&logo=solana&logoColor=black)](https://explorer.solana.com/address/BZ2pNdsvpYmeC3dfLKzpKWKqqqKxPBHMPTYr3qVTMRTz?cluster=devnet)

**Runs on** `http://localhost:3001`

</div>

---

> **The pitch.** Not stats. Not scores. *What the market is doing, what the sharp money is
> saying, what's about to happen, before it happens.* Pulse reads the same live odds and
> proofs the protocol runs on and translates them into plain-language commentary, alerts, and
> playful games for every fan, not just traders.

---

## 🧭 What this app is

Pulse is the top of the funnel. Zero crypto knowledge required to start: play a game with a
free paper wallet, get pinged when a match heats up, and a direct path down to the real
protocol when you want to put a verifiable pact on it.

| Route | What it does |
|---|---|
| `/` | Live / upcoming / finished WC matches, AI commentary feed, quick game CTAs |
| `/match/[id]` | Single-match hub: live score, odds movement, AI "market intelligence" commentary |
| `/hilo` | **Hi-Lo**: higher-or-lower, one tap, no wallet needed. Instant, addictive, on-ramp |
| `/sweepstake/[code]` | Shareable **sweepstakes**: join by code, draw against real match outcomes |
| `/mind/[sig]` | **Agent Mind**: inspect any ORA decision by its on-chain signature |
| `/alerts` | Web-Push alert subscriptions: goals, corners, "market moving" pings |
| `/wallet` | Privy embedded wallet + devnet faucet |

---

## ✨ The four things that make Pulse

1. **AI market-intelligence commentary.** A cron ([api/cron/commentary](src/app/api/cron/commentary))
   watches live odds + scores and, via **AceData Cloud** reasoning, narrates what the *market*
   is doing in real time: the sharp-money read a fan never gets. Stored in Supabase, streamed
   to the match view.
2. **Instant push alerts.** A real PWA with **Web Push** ([api/pulse/push](src/app/api/pulse/push)):
   subscribe once, get pinged on goals, corners, and market swings even with the app closed.
   Generate VAPID keys with `npx web-push generate-vapid-keys`.
3. **One-tap games.** **Hi-Lo** and **sweepstakes**: the no-friction, no-wallet hook that gets
   fans in, with `canvas-confetti` payoffs and `motion` polish. Games settle against the same
   real TxLINE match data as the protocol.
4. **The Agent Mind explorer.** Every ORA quote and settlement is inscribed on-chain via
   **OOBE Synapse**; `/mind` turns those signatures into a readable feed of *why* ORA did what
   it did, with verifiable P&L. The "glass skull," for fans.

---

## 🗂️ Key files

| Path | Role |
|---|---|
| [src/lib/pulse](src/lib/pulse) | Commentary, Hi-Lo, sweepstake, formatting logic |
| [src/lib/ora](src/lib/ora) | ORA pricing + on-chain reasoning (shared with the protocol) |
| [src/lib/txline](src/lib/txline) | TxLINE data client (proxied via `/api/txline/*`) |
| [src/app/api/pulse](src/app/api/pulse) | `commentary` · `hilo` · `sweepstake` · `mind` · `alerts` · `push` |
| [src/components/PushAlertsButton.tsx](src/components/PushAlertsButton.tsx) | Web-Push subscribe flow |

---

## 🚀 Run it

From the repo root, install once (`npm install`), then:

```bash
cd apps/pulse
cp .env.example .env.local     # shared values + the Pulse-only VAPID keys (see the root README)
npm run dev                    # → http://localhost:3001
```

Pulse shares the **same backend** as every other app: same ORA wallet, same TxLINE token,
same Supabase, same on-chain program. The only Pulse-specific env is the `NEXT_PUBLIC_VAPID_*`
Web-Push key pair. Full env table lives in the [monorepo README](../../README.md).

---

<div align="center">

**WHISTL Pulse** · *the match, in your pocket, before it happens.*

Part of the [WHISTL monorepo](../../README.md) · [Protocol](../whistl) · [TxAgent Desk](../trader)

</div>
