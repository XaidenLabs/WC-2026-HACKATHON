# build-context.md

Phase 2 (Build) handoff for WHISTL Protocol. Written by scaffold-project.

## project
- name: WHISTL Protocol
- pitch: Trustless P2P sports prop-bet escrow + on-chain settlement for the World Cup
  Hackathon 2026 (Superteam × TxODDS), track "Prediction Markets & Settlement" ($18k).
- deadline: 2026-07-19

## stack
- program: Anchor (Rust) — `programs/whistl`
- frontend: Next.js 14 + Tailwind + Solana wallet-adapter — `app/`
- agent (stretch): OOBE Protocol on-chain AI agent — `agent/`
- de-risk: dependency-free Node spikes — `derisk/`
- data: TxLINE REST + SSE (scores/odds/fixtures + 3-stage merkle proofs)
- settlement: CPI into TxLINE `validate_stat` (devnet `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`)

## architecture
- pattern: Next.js + Anchor dApp (Pattern 1) + On-chain Program (Pattern 4); Agent Kit (Pattern 2) for stretch.
- key decision: de-risk the validate_stat CPI (compute + tx-size limits) BEFORE building the app.
- escrow: USDC/USDT SPL token held in a per-pact PDA. No admin key.

## environment
- os: Windows 11; Solana CLI + Anchor NOT installed → WSL2 required for program builds.
- node 24, rust 1.96, cargo, git, yarn present.

## recommended skills
- programs-anchor, security, testing, frontend-framework-kit (official solana-new skills)

## build_status
mvp_complete: false
tests_passing: false
devnet_deployed: false
derisk_step: 2-blocked
# 1 = auth PROVEN live (01-auth.mjs returns a real guest JWT).
# 2 = subscribe+activate scripted (02-subscribe-activate.mjs). BLOCKED on devnet SOL:
#     public faucet returns 429. Throwaway wallet 35rve1jinPQf4shKZvohQm5ozBqLHhboEZ4BM7vqy52t
#     is saved in derisk/.env; needs devnet SOL via a Helius devnet RPC (set DEVNET_RPC_URL)
#     or https://faucet.solana.com, then `node fund.mjs` (or just re-run 02).
# next: 3 = fetch-proof, 4 = validateStat(...).view()==true, 5 = custom Anchor engine (WSL2).
# Direction DECIDED: custom on-chain settlement engine CPIing validate_stat + UI + OOBE keeper agent.

## next
Finish the de-risk staircase in `derisk/`, then proceed to build-with-claude / build-defi-protocol
for the core Anchor program.
