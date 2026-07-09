# WHISTL Protocol — Hackathon Demo Scripts (ORA Edition)

Three feature-complete, 5-minute demo scripts, one per track. These are written to show off the
**entire** product on each category, not a thin slice. Every screen you built has a moment here.

**Recording:** Loom or OBS, 1080p. Keep VSCode open in a second tab for the "under the hood" beats.
**Voice:** warm, fast, proud. About 140 words per minute. Smile, it carries.
**Punctuation note:** no em-dashes anywhere (they read as AI). Commas and periods only.

---

## The cast (say this the same way in every video)

**ORA** is the connective thread across all three apps. Introduce it once, identically:

> "ORA is an on-chain AI counterparty with a glass skull. It reads the live market, calls its
> shot, and inscribes every decision on Solana. You never have to trust ORA, because you can
> check it."

**The stack, name-dropped once each (do not over-explain):**
- **TxLINE / TxODDS** the hero. Verifiable, on-chain-anchored sports data, plus the `validate_stat` Merkle-proof settlement primitive. Mention it often.
- **Solana** the settlement and agent-memory chain.
- **OOBE Synapse** ORA's on-chain memory and identity.
- **AceData Cloud** the model that turns plain English into an executable strategy.
- **Privy** instant email wallets, zero seed phrases.

---

# 🟢 Track 1: WHISTL — Prediction Markets and Settlement

**Thesis:** trustless settlement you can actually read, with an AI counterparty so you never wait for liquidity.

### [0:00] Phase 1 · Hook and problem (45s)
*(Camera on you, then screen-share a raw block explorer with an ugly hash.)*

> "On-chain prediction markets have two silent killers. First, the settlement black box. When a
> bet resolves you get a cryptographic hash and you are told to trust it. No reason, no context.
> Second, peer-to-peer markets are ghost towns. If nobody takes the other side, there is no bet at
> all. WHISTL fixes both. Readable, provable settlement, and an always-on AI counterparty named
> ORA. Let me show you the whole flow."

### [0:45] Phase 2 · Full walkthrough (1:45)
*(Landing page. Point at the live proof-receipt hero.)*

> "This is WHISTL. Notice the hero is not a mockup, it is a real settled market pulled live from
> TxLINE. Two people wager on a verifiable World Cup stat, funds lock in a Solana escrow neither
> side controls, and the whistle, not an admin, decides."

*(Click Browse live markets to the `/matches` page. Scroll the real fixtures and live 1X2 odds.)*

> "Every real World Cup fixture is here with live odds straight from TxLINE. I can open any match
> for its ORA Sentinel analysis, but let me create a bet."

*(Click a match to `/pact/new`. Walk the builder slowly, this is the core.)*

> "This is the pact builder. Step one, I choose the stat. Not just who wins, but goals, cards, or
> corners, on a full match or a single half. I will bet Brazil corners minus Argentina corners is
> over three. Step two, my pick and my stake. And watch this panel, ORA's take. ORA instantly
> prices a fair line from the live TxLINE odds and offers to take the other side, so I never wait
> for a human. I confirm, both stakes lock in the escrow, and the pact is live."

*(Jump to `/bets`, open a settled pact, show the Proof Receipt.)*

> "Now the payoff, literally. Here is a settled pact. Instead of a hash, WHISTL gives a plain
> English verdict with a full statistical breakdown. The stat measured, the exact threshold, who
> won, and the on-chain proof reference. Anyone can read exactly why this resolved."

*(Open `/ora` for ORA Sentinel, then `/wallet`.)*

> "This is ORA Sentinel, the autonomous keeper. It watches every match event, updates its certainty
> for each open pact, and the moment an outcome is mathematically locked it settles on chain by
> itself. No human clicks settle. Over in the wallet you see the paper balance, the on-chain
> address, and a link to every transaction on the explorer. It is all real and all auditable."

### [2:30] Phase 3 · Under the hood, how TxLINE powers it (1:30)
*(VSCode: `apps/whistl/src/app/api/txline/proof/route.ts`, then the `settle_pact` instruction that CPIs `validate_stat`.)*

> "This readability is only possible because of TxLINE. When a match ends our backend does not
> guess. We fetch the cryptographic stat-validation bundle straight from the TxODDS feed through
> the TxLINE API, the Merkle proof for that exact stat. Our on-chain settle instruction then does a
> cross-program call into TxLINE's `validate_stat`, which verifies the proof and returns a clean
> true or false. We take that same deterministic TxLINE payload, the goals, the corners, the
> timestamps, and map it directly into the plain English Proof Receipt you just saw. The chain
> holds the money. TxLINE holds the truth. And ORA, with its memory on OOBE Synapse and its fair
> line priced from the TxLINE odds feed, is the counterparty that keeps the market alive."

### [4:00] Phase 4 · Close (30s)
*(Back to the dashboard.)*

> "Trustless settlement you can read, an AI counterparty that is always on and always auditable,
> and the deterministic truth of TxLINE underneath all of it. That is WHISTL, the prediction
> market bettors can finally trust. Thank you."

---

# 🔵 Track 2: PULSE — Consumer and Fan Experiences

**Thesis:** a premium Web2-grade fan app where the chain and the oracle are completely invisible, and ORA is your personal pundit.

### [0:00] Phase 1 · Hook and problem (40s)
*(Camera on you.)*

> "Sports fans want to feel the game. They do not want private keys, gas fees, or the word hash.
> Every Web3 consumer app fails the same way, it forces fans to become blockchain experts. So we
> hid the chain entirely, and we gave every fan a personal AI. This is PULSE."

### [0:40] Phase 2 · Full walkthrough (1:50)
*(Open PULSE in a mobile-sized window. Scroll the feed: Live now, Up next, Recent results.)*

> "PULSE feels like ESPN or DraftKings. Live matches, upcoming fixtures, recent results, all real
> from TxLINE. Now notice what is missing. No wallet address, no gas, no jargon. Just sports. Watch
> how much is packed in here."

*(Tap a match to `/match/[id]`. Show Quick Predict, live score and corners, Listen to Commentary, the verifiable badge.)*

> "Inside a match, one-tap Quick Predict. I back a side and I am done. Every prediction is publicly
> verifiable, but a fan never sees a hash, they see a clean Verified checkmark. And press this,
> Listen to Commentary. ORA generates a live AI pundit take on the match state and reads it out.
> The game, narrated by AI, in plain language."

*(Bottom nav to `/mind`, ORA · Your AI Pundit.)*

> "This is ORA's Mind, the glass skull. Every thought, every read, every call ORA makes is
> inscribed on Solana and shown here in plain English. Fans get a transparent AI pundit whose
> entire track record is public. Nothing hidden, nothing editable."

*(Hit `/hilo` for the game, then `/alerts` for Sharp Money, then `/sweepstake`, open one, show the Live Leaderboard.)*

> "It is also fun. Hi-Lo is a fast prediction game, will the next number go higher or lower. Alerts
> surface Sharp Money, the moment big line movement hits a market, powered by TxLINE odds. And
> Sweepstakes let a group compete on a shared code with a live leaderboard that updates as real
> results land. This is a full consumer product, not a demo."

*(Trigger a goal push notification if you can stage one.)*

> "And the second a goal is scored, PULSE fires an instant push notification. Fans stay glued."

### [2:30] Phase 3 · Under the hood, how TxLINE powers it (1:30)
*(VSCode: the `apps/pulse/src/app/api/txline/*` proxy routes, the `pulse/mind` and `pulse/alerts` routes, and the push cron.)*

> "A Web2 feel needs Web2 speed, and that is exactly how we use TxLINE. Our Next.js routes proxy
> the TxLINE feed for real-time fixtures, odds, and score events, with the API token held safely
> server-side so the fan device never sees it. Because TxLINE is fast and reliable, we detect a
> goal and fire a push notification with none of the latency of raw on-chain RPC. TxLINE is our
> single source of truth for every match event. The Sharp Money alerts read TxLINE line movement,
> and ORA reads that same live TxLINE feed to write its pundit takes, with its memory on OOBE
> Synapse and its reasoning on AceData Cloud. Privy gives every fan a wallet from just an email.
> The fan sees a beautiful, instant app. The chain and the oracle are invisible, and that is the
> entire point."

### [4:00] Phase 4 · Close (30s)
*(Back to the PULSE home feed.)*

> "PULSE proves the best blockchain experience is the one where the fan never knows it is there.
> Real-time truth from TxLINE, a personal AI in ORA, live games, sweepstakes, and alerts, with zero
> jargon. Just sports, elevated. Thank you."

---

# 🟠 Track 3: TRADER (TxAgent) — Trading Tools and Agents

**Thesis:** ORA is a transparent, one-tap AI trader. Casuals follow it in a tap, power users build their own agent, and every move is provable on chain.

### [0:00] Phase 1 · Hook and problem (45s)
*(Camera on you.)*

> "Algorithmic sports trading has two problems. The agents are black boxes, you hand over money and
> hope. And they are unusable for normal people, walls of config. So we asked, what if the AI agent
> was completely transparent, and following it took exactly one tap. That is ORA. ORA is an on-chain
> AI with a glass skull. It reads every World Cup market, calls its pick, and proves every decision
> on Solana."

### [0:45] Phase 2 · Full walkthrough (2:00)
*(Landing. Point at the live ORA bankroll card.)*

> "This is TxAgent. The home page is ORA advertising itself, and this bankroll card is live, read
> straight from ORA's real Solana history. Record, hit rate, return. Nothing here is faked."

*(Go to `/markets`. Show the full TxLINE market dump, flip the AI predictions toggle ON, change the stake amount.)*

> "Here is every live World Cup market from TxLINE. Now watch. I flip on AI predictions and ORA
> prices the entire board for me. For every match it names its call, the confidence, and exactly
> what I would earn. I change my stake and every payout updates. Match winner, and total goals over
> under, priced by ORA with no tapping required."

*(Open one match to `/market/[id]`. Show the live candlestick win-probability chart, 1X2 odds tabs, ORA reads the market, ORA's call, the goals card.)*

> "Open any match for the full desk. This is a live candlestick chart of the win probability,
> rebuilt from real TxLINE odds movement, refreshing every thirty seconds. ORA reads the market in
> plain English, and here are ORA's calls for this exact game, the match winner and the goals line,
> each one tap to back."

*(Tap Back ORA, land on `/prediction/[id]`. Show the receipt, then the Copy this prediction button.)*

> "One tap and I land on the prediction's own page, a verifiable receipt. My pick, entry odds, the
> live win chance updating as it plays, and it settles automatically on the real result. And this
> link is public. If I share it, anyone can back the exact same call on their own account, at the
> current price. A trading signal that is provably fair and instantly shareable."

*(Open `/ora` command center. Strategy Studio: type a strategy, compile, backtest, deploy. Then the on-chain ledger.)*

> "For power users, this is ORA's command center. I type a strategy in plain English, back the
> underdog when the money floods in before kickoff, and ORA compiles it into an executable rule.
> Before risking anything, I run a provably-fair backtest over real finished World Cup matches, and
> every result is Merkle-verifiable. Then I deploy ORA, and every call it takes is written to
> Solana with its reasoning attached. This ledger is its permanent public track record. Click one
> Solana link and the real transaction opens. It cannot be edited, by anyone, including us."

*(Optional: `/portfolio` to show the user's own paper wallet and open predictions.)*

> "And my portfolio tracks every prediction I have placed, settling automatically against real
> results."

### [2:45] Phase 3 · Under the hood, how TxLINE powers ORA (1:30)
*(VSCode: `apps/trader/src/lib/txline/server.ts`, `src/lib/ora/pick.ts`, `src/app/api/agent/deploy/route.ts`.)*

> "None of this works without the data, and every number ORA touches is TxLINE. Our server client
> authenticates to the TxLINE devnet feed and pulls live fixtures, odds, and scores. This file,
> pick dot ts, is ORA's brain, it takes the demargined 1X2 and over under markets straight from the
> TxLINE odds feed and derives ORA's call and the fair payout. When I deploy ORA, this route scans
> live TxLINE markets and fires the instant the odds cross the strategy threshold. And the
> settlement reads TxLINE's Merkle proof, the same `validate_stat` verification TxODDS built for on
> chain settlement, so ORA never guesses a result. TxLINE is the heartbeat. On top of it, ORA's
> memory runs on OOBE Synapse, the plain English compiler on AceData Cloud, and Privy gives every
> user an instant wallet."

### [4:15] Phase 4 · Close (30s)
*(The ORA ledger with the equity curve.)*

> "TxAgent makes algorithmic trading transparent and one tap simple. An AI agent you never have to
> trust, because ORA proves every move on Solana, powered end to end by the reliability of TxLINE.
> Thank you."

---

# Production checklist (read before you hit record)

- **Sign in first.** Every track needs a signed-in Privy session so wallets and one-tap actions work. If a button says "Sign in to ...", stop, log in, restart the take.
- **Use a hard-refreshed tab** (Cmd Shift R once) so no stale service worker serves old UI.
- **Have a finished match ready.** The WHISTL Proof Receipt and the Trader prediction settlement look ten times better on a match that already ended and shows a real WON or LOST verdict. Line one up before recording.
- **Click one real Solana link on camera.** In the ORA ledger (Trader) or the Proof Receipt (WHISTL), open a live explorer transaction. That single click sells "verifiable" harder than any sentence.
- **Flip the AI toggle slowly.** The Trader "flip on AI predictions and ORA prices the whole board" moment is the strongest 15 seconds in the whole demo. Let it breathe.
- **VSCode files to have open per track:**
  - WHISTL: `apps/whistl/src/app/api/txline/proof/route.ts` and the `settle_pact` / `validate_stat` CPI.
  - PULSE: `apps/pulse/src/app/api/txline/*` proxy routes, `pulse/mind` and `pulse/alerts` routes, push cron.
  - TRADER: `apps/trader/src/lib/txline/server.ts`, `src/lib/ora/pick.ts`, `src/app/api/agent/deploy/route.ts`.
- **Name-drop once, no more:** TxLINE / TxODDS (often), Solana, OOBE Synapse, AceData Cloud, Privy.
- **If the TxLINE feed blips mid-record,** the apps keep showing the last good data, so keep talking. If a page is truly empty, refresh once and continue.

# 90-second sizzle (optional, one cut across all three)

For a single short teaser: open on ORA's live bankroll card (Trader), flip the AI toggle and back a
pick in one tap, cut to WHISTL's plain-English Proof Receipt resolving a real match, cut to PULSE's
ORA's Mind glass skull scrolling its on-chain thoughts, end on a real Solana explorer transaction
with the line, "The chain holds the money. TxLINE holds the truth. ORA proves it."
