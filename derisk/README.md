# WHISTL — De-risk spikes

The single most important question for WHISTL: **does the trustless settlement path
actually work end-to-end?** That is — can we fetch a real finished-match Merkle proof
from TxLINE and have the on-chain `validate_stat` instruction return `true`, and can we
then call it via CPI from our own program?

We answer that *before* writing the full Anchor program, the frontend, or the agent.
Each step below is a small, runnable script. We climb the staircase one rung at a time.

## The staircase

| Step | Script | Proves | Needs |
|------|--------|--------|-------|
| 1 | `01-auth.mjs` | We can reach TxLINE + get a guest JWT | Node only |
| 2 | `02-subscribe-activate.mjs` | We can activate the free WC tier → get an `X-Api-Token` | Node + a devnet wallet (free SOL) |
| 3 | `03-fetch-proof.mjs` | We can pull a real finished match's stat-validation proof | step 2 token |
| 4 | `04-validate-onchain.mjs` | `validate_stat(...).view()` returns `true` for that proof ← **THE BIG ONE** | `@coral-xyz/anchor`, `@solana/web3.js` |
| 5 | (Anchor, in WSL2) | A `settle_pact` CPI into `validate_stat` fits compute + tx-size limits | Solana CLI + Anchor |

Steps 1–4 run on **native Windows with Node** — no Solana CLI, no Anchor, no deploy.
Only step 5 needs the full toolchain (WSL2).

## Confirmed facts (don't re-research these)

- **Devnet program:** `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- **TXL mint (devnet):** `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG`
- **USDT mint (devnet):** `ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh`
- **`validate_stat`** returns `bool`, reads one account `daily_scores_merkle_roots`, args:
  `(ts: i64, fixture_summary: ScoresBatchSummary, fixture_proof: Vec<ProofNode>,
    main_tree_proof: Vec<ProofNode>, predicate: TraderPredicate, stat_a: StatTerm,
    stat_b: Option<StatTerm>, op: Option<BinaryExpression>)`
- **Auth:** guest JWT (`POST /auth/guest/start`) + `X-Api-Token` (from subscription activation).
- Data endpoints require **both** `Authorization: Bearer <jwt>` and `X-Api-Token`.

## Run

```bash
cd derisk
node 01-auth.mjs          # step 1, works right now
cp .env.example .env      # then fill in for steps 2+
```
