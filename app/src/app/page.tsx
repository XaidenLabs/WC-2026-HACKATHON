import Link from "next/link";

function SettlementReceipt() {
  return (
    <div
      className="animate-rise w-full max-w-md rounded-xl border border-line bg-ink-2 font-mono text-xs sm:text-sm"
      style={{ animationDelay: "180ms" }}
    >
      <div className="flex items-center justify-between border-b border-line px-4 sm:px-5 py-3 text-text-dim">
        <span>PACT #1042</span>
        <span className="inline-flex items-center gap-2 text-signal">
          <span aria-hidden>✓</span> SETTLED
        </span>
      </div>
      <div className="space-y-3 px-4 sm:px-5 py-4 sm:py-5">
        <p className="font-sans text-sm sm:text-base text-text">
          Brazil corners − Argentina corners&nbsp;&gt;&nbsp;3
        </p>
        <div className="grid grid-cols-2 gap-y-2 text-text-dim">
          <span>final</span>
          <span className="text-right text-text">BRA 8 − ARG 4 = +4</span>
          <span>predicate</span>
          <span className="text-right text-signal">TRUE</span>
          <span>proof</span>
          <span className="text-right text-text">c7e3…91b8</span>
          <span>payout</span>
          <span className="text-right text-text">20.00 USDC → creator</span>
        </div>
      </div>
      <div className="border-t border-line px-4 sm:px-5 py-3 text-[10px] sm:text-xs text-text-dim">
        verified on-chain via TxLINE&nbsp;
        <span className="text-proof">validate_stat</span> · no admin signed this
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 sm:gap-12 px-4 sm:px-6 pb-16 sm:pb-24 pt-8 sm:pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <div>
          <p className="animate-rise mb-4 sm:mb-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-[10px] sm:text-xs text-text-dim">
            <span className="size-1.5 rounded-full bg-live animate-livedot" aria-hidden />
            FIFA WORLD CUP 2026 · TRUSTLESS SETTLEMENT
          </p>
          <h1
            className="animate-rise text-balance text-3xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight"
            style={{ animationDelay: "60ms" }}
          >
            Bet the match.
            <br />
            The <span className="text-signal">whistle</span> settles it.
          </h1>
          <p
            className="animate-rise mt-4 sm:mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-text-dim"
            style={{ animationDelay: "120ms" }}
          >
            Two people wager on a verifiable World Cup stat. Funds lock in a Solana
            escrow. When the match ends, a TxLINE Merkle proof — not an admin —
            releases the money to the winner.
          </p>
          <div
            className="animate-rise mt-6 sm:mt-8 flex flex-wrap gap-3"
            style={{ animationDelay: "160ms" }}
          >
            <Link
              href="/matches"
              className="rounded-md bg-signal px-5 py-3 font-medium text-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Browse live markets
            </Link>
            <Link
              href="#how"
              className="rounded-md border border-line px-5 py-3 font-medium text-text transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              How it works
            </Link>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <SettlementReceipt />
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    t: "Create a pact",
    d: "Pick a fixture and a verifiable stat — goals, corners, cards, or a margin like \u201ccorners diff > 3\u201d. Stake USDC; it locks in a program escrow.",
  },
  {
    n: "02",
    t: "Someone takes it",
    d: "A counterparty stakes the matching side. Terms are committed on-chain. Now both stakes sit in a PDA neither side controls.",
  },
  {
    n: "03",
    t: "The proof settles it",
    d: "At full time, anyone (or our keeper agent) submits TxLINE\u2019s Merkle proof. The program CPIs validate_stat and pays the winner. No oracle, no admin.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-t border-line bg-ink">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-12 sm:py-20">
        <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-text-dim">
          How settlement works
        </h2>
        <div className="mt-8 sm:mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-ink-2 p-5 sm:p-7">
              <span className="font-mono text-sm text-signal">{s.n}</span>
              <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-text">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 sm:px-6 py-6 sm:py-8 text-sm text-text-dim sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono text-sm font-bold tracking-widest text-text">WHISTL</span>
        <p className="font-mono text-xs">
          No oracle. No admin. The whistle decides.
        </p>
        <p className="text-xs">World Cup 2026 Hackathon · Powered by TxLINE</p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <main className="flex-1">
        <Hero />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
