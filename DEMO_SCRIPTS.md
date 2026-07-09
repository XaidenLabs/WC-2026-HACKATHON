# WHISTL Protocol — Hackathon Demo Scripts (ORA Edition)

Three demo scripts, one per track. Written in plain, everyday English so anyone can follow, and
built to show off EVERY feature of each app. Read the quoted lines out loud. The lines in italics
tell you what to click.

**Recording:** Loom or OBS, 1080p. Keep your code editor open in a second tab for the "how it works"
part. **Voice:** friendly and confident, not rushed. Smile, it comes through.
**No dashes in speech.** Use short sentences.

---

## Who is ORA? (say this the same way in all three videos)

> "ORA is an AI that predicts football, and it is honest by design. It shows its thinking. It only
> bets when the numbers are in its favour. And it writes every single decision onto a public
> blockchain, so you can check its record yourself. You never have to trust ORA. You can just look."

**The tools you will name, in plain words (only in the "how it works" section):**
- **TxLINE (by TxODDS)** where all the live football data comes from. Scores, odds, match events. And it is signed so you can prove it is real.
- **Solana** the public record where ORA writes its decisions and where the money settles.
- **OOBE Synapse** ORA's memory.
- **AceData Cloud** the AI that turns plain English into a working strategy.
- **Privy** sign in with just an email. No crypto wallet needed.

---

# 🟢 Track 1: WHISTL — Prediction Markets and Settlement

**In one line:** bets that pay themselves from real match data, with a receipt you can actually read.

### [0:00] The problem (45 seconds)
*(You on camera, then show a messy blockchain code on screen.)*

> "When you bet online today, you have to trust the website to pay you fairly. And when a crypto
> bet finishes, all you get is this: a scary string of letters and numbers, with no explanation.
> WHISTL fixes both problems. Our bets settle themselves from real match data. And instead of a
> code, you get a plain-English receipt that shows you exactly why you won or lost."

### [0:45] The full walkthrough (1 minute 50)
*(Open the WHISTL home page.)*

> "This is WHISTL. That example on the front is a real, finished bet, pulled live from the data
> feed. The idea is simple. Two people bet on something you can measure in a match. The money gets
> locked away safely. And when the match ends, the result decides who wins. Not a company. Not an
> admin."

*(Click into the Matches page.)*

> "Here is every real World Cup game, with live odds. Let me make a bet."

*(Open the bet builder. Go slowly, this is the heart of it.)*

> "I pick what to bet on. And it is not just who wins. I can bet on goals, on cards, on corners,
> for a full match or just one half. I will say: France gets more corners than Morocco, by more
> than three. I choose my side, and how much to stake."

*(Point at ORA's take.)*

> "Now normally you would have to find another person to bet against. You do not. ORA reads the
> real odds, works out a fair price, and takes the other side of my bet instantly. So there is
> always someone to bet with. I confirm, and both our stakes go into a locked vault that neither of
> us can touch."

*(Open a finished bet and show the Proof Receipt.)*

> "Here is the magic. When the match ends, this is what you get. Not a code. A sentence. It says you
> won because France had eight corners and Morocco had four, a difference of four, over your line
> of three. It shows the exact numbers, and a link to prove it on the blockchain. Anyone can read
> exactly why this bet resolved the way it did."

*(Open ORA Sentinel, then the Wallet.)*

> "And this is the robot that runs it, ORA Sentinel. It watches every match, and the moment the
> result is locked in, it pays the winner automatically. No human presses a button. Over in the
> wallet you can see your balance, your address, and a link to every transaction. It is all real
> and all checkable."

### [2:35] How it works, and why the money is safe (1 minute 20)
*(Open your code editor. Show the proof route and the settle function that calls validate_stat.)*

> "Here is how the money moves safely. When a match ends, our program does not guess the score. It
> asks TxLINE for a cryptographic proof of the exact stat, like a tamper-proof receipt from the data
> provider. Our smart contract checks that proof on the blockchain, using TxLINE's validate stat,
> and it only pays out if the proof is genuine. We also hardened this contract, so that even the
> person who triggers the payout cannot send the money to themselves. It can only ever go to the two
> people in the bet. And it is freshly deployed on Solana, and it can be upgraded. So, the blockchain
> holds the money, and TxLINE holds the truth."

### [3:55] Close (30 seconds)
*(Back to the dashboard.)*

> "Bets that pay themselves, from real data, with a receipt you can actually read. That is WHISTL.
> Thank you."

---

# 🔵 Track 2: PULSE — Consumer and Fan Experiences

**In one line:** a beautiful football app with an AI pundit, where the blockchain is invisible.

### [0:00] The problem (40 seconds)
*(You on camera.)*

> "Most football apps are boring. And every crypto app makes fans feel stupid, with wallets, fees,
> and jargon. Fans just want to enjoy the game. So we built a gorgeous, simple app, gave it an AI
> pundit, and hid all the blockchain stuff completely. This is PULSE."

### [0:40] The full walkthrough (2 minutes)
*(Open PULSE on a phone-sized window. Scroll the feed.)*

> "PULSE feels like a top sports app. Live games, what is coming up, recent results, all real. And
> notice, there is no wallet, no fees, no confusing words. Just football. Now look how much is in
> here."

*(Tap a match. Show the live score, Quick Predict, Listen to Commentary, the Verified tick.)*

> "Inside a match, you get the live score, and one-tap Quick Predict. You back a side and you are
> done. Every prediction is saved and provable, but you never see a scary code, you just see a
> clean green Verified tick. And press this, Listen to Commentary. ORA talks you through the match
> out loud, like a real pundit."

*(Open ORA's Mind.)*

> "This is the fun part, ORA's Mind. ORA is our AI pundit, and its brain is made of glass. Every
> take, every call it makes, is written publicly on the blockchain. You can scroll its whole track
> record. Nothing is hidden, nothing can be edited."

*(Tap a call to open its shareable card.)*

> "And tap any call, and you get a shareable card. ORA called it, here is the proof. Anyone you send
> it to can open it and check it themselves. It is built to spread."

*(Point at the ORA Pro box.)*

> "Here is the business too. ORA Pro. Five dollars a month for instant alerts and ORA's best picks.
> Or you can earn it for free by winning a sweepstake. The free version stays public forever. Pro is
> the upgrade."

*(Go to Hi-Lo, then Alerts, then Sweepstakes and open one to show the live leaderboard.)*

> "There is more. Hi-Lo is a quick game, will the next stat be higher or lower, build a streak.
> Alerts flag the moment the smart money moves a game's odds. And Sweepstakes let you play with
> friends on a shared code, with a leaderboard that updates live from the real match, so no more
> arguing over a spreadsheet."

*(If you can, trigger a goal notification.)*

> "And the second a goal is scored, PULSE buzzes your phone. Fans stay glued."

### [2:40] How it works (1 minute 20)
*(Open your code editor. Show the data routes and the goal-alert job.)*

> "To feel this fast, we pull live data from TxLINE through our own server, so your phone never
> touches a wallet or a key. The moment a goal shows up in the TxLINE data, we push you a
> notification, instantly. ORA reads that same live data to write its takes. The blockchain and the
> data provider do all the heavy lifting behind the scenes, and the fan never has to know."

### [4:00] Close (30 seconds)
*(Back to the home feed.)*

> "A premium fan app where you never realise you are using a blockchain. Live games, an AI pundit,
> sweepstakes, and alerts, with zero jargon. Just football, made better. Thank you."

---

# 🟠 Track 3: TxAGENT (ORA) — Trading Tools and Agents

**In one line:** an AI that trades football on its own, shows its math, and proves every move.

### [0:00] The problem (45 seconds)
*(You on camera.)*

> "AI trading is usually a black box. You hand over your money and you hope. And it is far too
> complicated for a normal person. We fixed both. Meet ORA, an AI that trades football, shows you
> its maths, only bets when the numbers are in its favour, and does the whole thing by itself."

### [0:45] The full walkthrough (2 minutes 10)
*(Open the home page. Point at ORA's live scoreboard.)*

> "This is TxAgent. The whole front page is ORA showing off, and this scoreboard is live, read
> straight from the blockchain. Its balance, its wins and losses, its return. None of it is faked."

*(Go to Markets. Flip on the AI predictions toggle. Change the stake.)*

> "Here is every live game. Now watch, I flip on AI predictions, and ORA prices the whole board for
> me. For every game it shows its pick, how confident it is, and exactly what I would win. I can
> change my stake, and every payout updates."

*(This is the key moment. Find a game where ORA does NOT pick the favourite.)*

> "And here is the clever part. Look at this game. The odds say France is the big favourite. ORA is
> not backing France. ORA is backing the draw. Why? ORA works out its own honest chance for each
> result, and it knows people bet too heavily on favourites and forget the draw. When ORA's number
> is higher than the market's, that gap is an edge. It even shows the maths, my number twenty five
> percent, the market's twenty four, expected profit plus three percent."

*(Scroll to a game where ORA passes.)*

> "And on this game, ORA refuses to bet. No edge, so it stands aside. That is the smartest thing an
> AI can do, and it is how you know this is real and not just hype."

*(Open one match for the full desk. Show the chart, ORA's read, the winner call and the goals call.)*

> "Open any game for the full desk. This is a live chart of the winning chance, built from the real
> odds. ORA reads the game in plain English. And here are its calls, who wins, and total goals, over
> or under, each one tap to back."

*(Tap Back, land on the prediction receipt, then show Copy this prediction.)*

> "One tap, and I land on my bet's own page. My pick, the live chance, and it settles by itself when
> the match ends. And this link is public. I can share it, and anyone can copy the exact same bet on
> their own account. My portfolio here tracks every bet I have made."

*(Open the ORA command centre. Show the Strategy Studio quickly.)*

> "Want to build your own AI? Type a strategy in plain English. ORA turns it into rules, tests it on
> real past matches to prove it works, then puts it live."

*(Now the headline. Flip on ORA Autopilot and let it run.)*

> "And here is the big one. I flip this switch, ORA Autopilot, and ORA now trades entirely on its
> own. It scans every live game, finds the value bets, and writes each one to the blockchain, with
> no clicks from me. Watch, it just backed two draws and posted them on Solana. In real life this
> runs on a schedule around the clock, so ORA trades even when nobody is watching. And it is
> disciplined, if there is nothing worth betting, it sits out. Below, the ledger shows every call it
> has made, its reasoning, a link to the real transaction, and its running profit."

### [2:55] How it works (1 minute 15)
*(Open your code editor. Show pick.ts, the autopilot job, and vercel.json.)*

> "Everything ORA touches comes from TxLINE, live odds and scores. Its brain is a value model. It
> takes the real odds, works out its own honest chance, subtracts a realistic fee, and only bets
> when it is ahead. It is not picking favourites, it is finding mistakes in the market. When it
> decides, it writes the call to Solana, so nobody can fake or edit its record. When a match ends,
> it checks TxLINE's cryptographic proof to settle. It never guesses. And the schedule that runs it
> is a real cron job, so it is genuinely automatic."

### [4:10] Close (30 seconds)
*(The ledger with the running profit.)*

> "An AI trader you never have to trust, because it proves every move. And it runs itself. That is
> TxAgent. Thank you."

---

# Before you record (quick checklist)

- **Sign in first.** Every app needs you signed in for wallets and one-tap buttons to work. If a
  button says "Sign in", stop and log in, then start the take again.
- **Refresh the tab once** with Cmd Shift R so you are not seeing an old cached version.
- **Have a finished match ready.** The WHISTL receipt and the TxAgent settlement look far better on a
  game that has already ended and shows a real Won or Lost. Line one up.
- **Click one real blockchain link on camera.** In the TxAgent ledger or the WHISTL receipt, open a
  real transaction in the explorer. That one click proves everything is real.
- **The three moments that win it:**
  1. TxAgent: flip on AI predictions and show ORA backing the draw over the favourite, then a game
     where it passes.
  2. TxAgent: arm the Autopilot and watch ORA trade by itself.
  3. WHISTL: the plain-English proof receipt resolving a real match.
- **Files to open in your editor per track:**
  - WHISTL: the proof route and the settle function that calls validate stat.
  - PULSE: the TxLINE data routes and the goal-alert job.
  - TxAgent: `lib/ora/pick.ts`, the autopilot route, and `vercel.json`.
- **Names to say once each:** TxLINE and TxODDS (say often), Solana, OOBE Synapse, AceData Cloud, Privy.
- **If the data blips mid-record,** the apps keep showing the last good info, so keep talking. If a
  page is truly empty, refresh once and carry on.

# 90-second teaser (one short cut across all three)

Open on ORA's live scoreboard in TxAgent. Flip on AI predictions and back a pick in one tap. Cut to
arming the Autopilot and ORA trading itself. Cut to WHISTL's plain-English receipt resolving a real
match. Cut to PULSE's ORA's Mind scrolling its public calls. End on a real blockchain transaction
with the line: "The blockchain holds the money. TxLINE holds the truth. ORA proves it."
