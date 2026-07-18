<div align="center">

# 🟠 TxAgent Desk: back the AI, or build your own

### Back the AI. Win if it's right.

The *power-user* face of the [WHISTL monorepo](../../README.md): a trading terminal for the
World Cup. In one tap you back ORA's on-chain picks; in one paragraph of plain English you
compile, backtest, and deploy your **own** trading agent against real TxLINE odds. Every call
is inscribed on Solana and settled by a TxLINE proof: no black box, no admin.

[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![Solana](https://img.shields.io/badge/Solana-Devnet-14F195?style=for-the-badge&logo=solana&logoColor=black)](https://explorer.solana.com/address/9xe1gCVh7kNqjfRbidVUpWBcS2A4EstvkBMkxc34LWRR?cluster=devnet)
[![Charts](https://img.shields.io/badge/Charts-lightweight--charts-FF5F1F?style=for-the-badge)](https://tradingview.github.io/lightweight-charts/)

**Runs on** `http://localhost:3000`

</div>

---

> **The pitch.** ORA is an on-chain AI that reads every World Cup market and calls its pick.
> Tap once to back it in the live-data devnet environment, and you win if ORA's right. Or go a level
> deeper: describe a strategy in plain English, watch it compile, backtest it on real odds
> history, and deploy it as a live agent that trades for you.

---

## 🧭 What this app is

Two products in one desk, sharing the same settlement rails as the protocol:

**① Follow mode: back the AI.**

| Route | What it does |
|---|---|
| `/markets` · `/market/[id]` | Live WC markets with odds charts (lightweight-charts) |
| `/prediction/[id]` | ORA's pick for a fixture, inscribed on-chain, one-tap **Back** |
| `/portfolio` | Your open positions + settled P&L |

**② Build mode: deploy your own agent.**

| Route / endpoint | What it does |
|---|---|
| `/ora` | Meet ORA + the strategy builder |
| [api/agent/compile](src/app/api/agent/compile) | Plain-English strategy → structured rules (AceData Cloud) |
| [api/agent/backtest](src/app/api/agent/backtest) | Replay the compiled strategy over real odds history |
| [api/agent/deploy](src/app/api/agent/deploy) | Deploy it as a live agent |
| [api/agent/autopilot](src/app/api/agent/autopilot) | The agent trades automatically as odds move |
| [api/agent/ledger](src/app/api/agent/ledger) | Verifiable on-chain record of every agent action |

---

## ✨ The flow that makes the Desk

1. **Natural-language strategy compiler.** Write *"back the favourite when their win-odds drift
   above 55% in the second half"*, and the compiler ([api/agent/compile](src/app/api/agent/compile))
   turns it into executable rules via **AceData Cloud** reasoning. No config, no code.
2. **Backtest on real odds.** Before you risk anything, replay the strategy over genuine TxLINE
   odds history ([api/agent/backtest](src/app/api/agent/backtest)) and see the equity curve
   (`recharts`).
3. **Deploy + autopilot.** Ship the agent and let it trade as markets move
   ([api/agent/autopilot](src/app/api/agent/autopilot)). Every decision is written to a
   verifiable ledger.
4. **Settled by proof, not by us.** Positions resolve against the real match result through the
   same `validate_stat` settlement the protocol uses, so the Desk never decides who won.

---

## 🗂️ Key files

| Path | Role |
|---|---|
| [src/lib/agent](src/lib/agent) | Strategy compiler, backtester, autopilot engine |
| [src/lib/trader](src/lib/trader) | Markets, predictions, bet + wallet logic |
| [src/lib/ora](src/lib/ora) | ORA picks (shared reasoning brain) |
| [src/lib/txline](src/lib/txline) | TxLINE odds/scores client (proxied via `/api/txline/*`) |
| [src/app/api/agent](src/app/api/agent) | `compile` · `backtest` · `deploy` · `autopilot` · `ledger` · `chart` |

---

## 🚀 Run it

From the repo root, install once (`npm install`), then:

```bash
cd apps/trader
cp .env.example .env.local     # shared values (see the root README's Environment table)
npm run dev                    # → http://localhost:3000
```

The Desk shares the **same backend** as every other app: same ORA wallet, same TxLINE token,
same Supabase, same on-chain program. Full env table lives in the
[monorepo README](../../README.md).

---

<div align="center">

**TxAgent Desk** · *back the AI, or become one.*

Part of the [WHISTL monorepo](../../README.md) · [Protocol](../whistl) · [Pulse](../pulse)

</div>
