<div align="center">

# 🟢 WHISTL: the protocol

### Create a pact. ORA takes the other side. The final whistle pays the winner.

The reference product of the [WHISTL monorepo](../../README.md): a trustless P2P prop-bet
protocol on Solana. Two people wager on a verifiable World Cup stat, funds lock in a PDA
escrow, and when the match ends **anyone** can settle: the on-chain program CPIs directly
into TxODDS's `validate_stat` and pays the winner in the same transaction.

[![Solana](https://img.shields.io/badge/Solana-Devnet-14F195?style=for-the-badge&logo=solana&logoColor=black)](https://explorer.solana.com/address/BZ2pNdsvpYmeC3dfLKzpKWKqqqKxPBHMPTYr3qVTMRTz?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-Program_Live-512BD4?style=for-the-badge)](https://explorer.solana.com/address/BZ2pNdsvpYmeC3dfLKzpKWKqqqKxPBHMPTYr3qVTMRTz?cluster=devnet)
[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)

**Runs on** `http://localhost:3000`

</div>

---

> **The one sentence.** Two people wager on a verifiable World Cup stat
> (*"Brazil corners − Argentina corners > 3"*); funds lock in a PDA escrow, and when the
> match ends **anyone** can settle: our on-chain program **CPIs directly into TxODDS's
> `validate_stat`**, reads a Merkle proof of the real result, and pays the winner in the
> same transaction. No oracle. No admin. No manual resolution. **The chain decides.**

---

## 🧭 What this app is

WHISTL is the reference product for the protocol. It's where the on-chain mechanics are
exposed most directly: you browse real World Cup fixtures, build a pact from live odds,
ORA takes the counter-side, and, once the match is final, one click settles it and prints
a **proof receipt** showing exactly which Merkle proof decided the payout.

| Route | What it does |
|---|---|
| `/matches` | Real WC fixtures from TxLINE: live, upcoming, finished |
| `/pact/new` | Bet creator: pick a stat + threshold, get ORA's fair line, stake, create |
| `/pact` · `/bets` | Your open and settled pacts, with live status |
| `/ora` | The **Agent Mind**: ORA's quotes, decisions, and on-chain P&L |
| `/wallet` | Privy embedded wallet, faucet for devnet test-USDC |

---

## 🧠 How settlement actually works

This is the part the track brief says judges "highly value," so here it is with no hand-waving.

```
 traderA                          traderB / ORA
    │  create_pact(id, stakeA,        │  accept_pact(stakeB)
    │  terms: statA/statB/op,         │
    │  threshold, comparison)         ▼
    └──────────────►  ┌─────────────────────────┐
                      │   PDA: ["pact", id]     │   ← escrow authority
                      │   escrow_vault (SPL)    │   ← holds stakeA + stakeB
                      └───────────┬─────────────┘
                                  │
             match ends. anyone calls settle_pact(...)
                                  │
                                  ▼
        ┌───────────────────────────────────────────────┐
        │  settle_pact                                   │
        │  1. require pact.status == Accepted            │
        │  2. reject empty proofs (anti-exploit)         │
        │  3. build ValidateStatArgs from pact terms     │
        │  4. CPI ──► TxODDS validate_stat               │
        │        (reads daily_scores_merkle_roots PDA)   │
        │  5. get_return_data()                          │
        │     └─ require returning_program == txoracle   │  ← can't be spoofed
        │  6. bool = return_data[0] != 0                 │
        │  7. transfer FULL pot ──► winner, PDA-signed   │
        └───────────────────────────────────────────────┘
                                  │
                                  ▼
                    winner paid · pact = Settled
```

**Why this is trustless, not "trust-me":**

- **The verifier is TxODDS's, not ours.** We don't score matches. We ask the same on-chain
  program the judges built, and it answers from published Merkle roots.
- **Provenance is enforced.** After the CPI we call `get_return_data()` and
  `require_keys_eq!(returning_program, txoracle::ID)`, so a malicious program can't sit in the
  middle and lie about the result. ([lib.rs:174-182](../../whistl/programs/whistl/src/lib.rs))
- **No empty-proof exploit.** Empty `fixture_proof` / `stat_a_proof` are rejected before the
  vecs are consumed. ([lib.rs:98-102](../../whistl/programs/whistl/src/lib.rs))
- **`ts = fixture_summary.updateStats.minTimestamp`**, and the roots PDA is
  `["daily_scores_roots", u16_le(floor(minTimestamp / 86_400_000))]`, verified against a real
  finished match in [derisk/04](../../derisk/04-validate-onchain.mjs).
- **Cost:** the whole `validate_stat` verification is ≈ **5.8k CU**. Trustless settlement is
  essentially free.

On-chain instructions: `create_pact` · `accept_pact` · `settle_pact` · `cancel_pact` ·
`save_commentary` (ORA writes its reasoning on-chain). Source:
[whistl/programs/whistl/src/lib.rs](../../whistl/programs/whistl/src/lib.rs).

---

## 🤖 ORA: the verifiable AI counterparty

P2P markets die of loneliness: nobody to take the other side. WHISTL doesn't have that
problem, because the house is an agent named **ORA**, and ORA is made of glass.

1. **Always-on liquidity.** ORA prices a fair line from live TxODDS odds (reasoning via
   **AceData Cloud** `gpt-4o-mini`) and instantly takes the counter-side of any pact. You can
   always bet.
2. **Glass skull.** Every quote, decision, and settlement is inscribed on-chain through
   **OOBE Synapse** agent memory (`save_commentary`) → the auditable **Agent Mind** explorer
   at `/ora`, where you watch ORA think and check its P&L.
3. **Keeper.** A bot ([src/lib/ora/keeper.ts](src/lib/ora/keeper.ts)) watches for finished
   pacts and fires the settlement CPI automatically: the brief's named *"keeper bot,"* shipped.

---

## 🗂️ Key files

| Path | Role |
|---|---|
| [src/lib/whistl](src/lib/whistl) | Anchor program client: IDL, PDA helpers, `create/accept/settle` builders |
| [src/lib/ora](src/lib/ora) | ORA pricing brain, keeper, on-chain commentary |
| [src/lib/txline](src/lib/txline) | TxLINE data client + types (proxied through `/api/txline/*`) |
| [src/app/api/pacts](src/app/api/pacts) | Pact CRUD + `/[id]/settle` |
| [src/app/api/ora](src/app/api/ora) | `quote` · `accept` · `settle` · `keeper` · `fulfill` |
| [src/app/api/faucet](src/app/api/faucet) | Mints devnet test-USDC + rent SOL for demos |

---

## 🚀 Run it

From the repo root, install once (`npm install`), then:

```bash
cd apps/whistl
cp .env.example .env.local     # fill in the shared values (see the root README's Environment table)
npm run dev                    # → http://localhost:3000
```

The app talks to the **already-deployed devnet program**, so you don't need Solana CLI or
Anchor to run or demo it. Env, program IDs, and the shared backend are documented in the
[monorepo README](../../README.md).

---

<div align="center">

**WHISTL** · *the whistle blows, the chain decides.*

Part of the [WHISTL monorepo](../../README.md) · [Pulse](../pulse) · [TxAgent Desk](../trader)

</div>
