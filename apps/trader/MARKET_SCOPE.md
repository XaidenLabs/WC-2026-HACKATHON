# D002 — Football-first market scope

## Decision

TXAgent launches as a football-only application. The ORA engine supports football markets only. Basketball, tennis, cricket and every other sport remain outside the product until football demonstrates commercial traction and the founder explicitly approves expansion.

## What “football-only” means

- Customer-facing copy describes ORA as a football-market agent.
- Sportmonks supplies fixture, prediction, score, and bookmaker-price intelligence.
- TxLINE remains the planned proof layer for verifiable on-chain settlement.
- ORA currently supports match winner, BTTS, and every compatible total-goals line returned by the live feed.
- Requests that explicitly name another sport are rejected instead of being silently converted into football strategies.
- The interface does not show inactive sport tabs or imply that more sports are already supported.

## Expansion gate

Another sport may be evaluated only after there is documented evidence of:

1. paying football users;
2. repeat usage or retention from those users;
3. reliable football data, alerts and decision records; and
4. a clear distribution advantage for the proposed sport.

Expansion requires a new founder decision in the decision log. It is not an automatic roadmap item.

## Football market rollout

### Live now

1. Match winner: home, draw, or away.
2. Both teams to score: yes or no.
3. Total goals: over or under a quoted line, including 1.5, 2.5, 3.5, and 4.5 when the provider returns a complete executable market.

Every live market must have a complete bookmaker quote, an independent Sportmonks probability, measured league-model quality, a fresh execution quote, and a deterministic result rule. ORA passes when any requirement is missing.

### Candidate markets

- Double chance.
- Draw no bet.
- Asian handicap.
- Team total goals.
- First-half result and first-half goals.
- Corners and corner handicaps.
- Cards and card handicaps.
- Team to score first or last.
- Correct score.

These markets are visible roadmap candidates, not active ORA authority. Each requires a compatible probability model, coherent executable odds, result settlement, TxLINE proof mapping, tests, and explicit user mandate support before activation.

## Why this boundary matters

Football offers the clearest initial demand and distribution opportunity in Nigeria. Concentrating the product keeps the model, user experience, data quality and commercial message coherent while the team proves whether users will pay.
