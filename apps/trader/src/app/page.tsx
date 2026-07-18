import Link from "next/link";
import { Brain, MousePointerClick, ShieldCheck, Trophy, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import OraLiveCard from "@/components/OraLiveCard";

// Landing page for TxAGENT Desk. The home experience is dead simple: ORA calls its picks from
// live TxLINE odds, you back them in one tap. Power tools (build-your-own agent) live at /ora.

const STEPS = [
  {
    icon: <Brain className="size-4" />,
    n: "01",
    t: "ORA calls its pick",
    d: "ORA reads every live World Cup market and names the side it rates highest · inscribed on Solana, verifiable by anyone.",
  },
  {
    icon: <MousePointerClick className="size-4" />,
    n: "02",
    t: "You tap Back",
    d: "Save a live-data research read, or open a real devnet WHISTL escrow pact when you want funds on-chain.",
  },
  {
    icon: <Trophy className="size-4" />,
    n: "03",
    t: "Win on the real result",
    d: "WHISTL escrow pacts settle against the real TxLINE score. Research reads stay clearly separated from funds.",
  },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-[#050505] font-mono text-gray-300">
      <Header tagline="back the AI · win if it's right" />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_60%)]" aria-hidden />
          <div className="relative mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-wider text-gray-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                World Cup 2026 · verifiable AI picks
              </p>
              <h1 className="font-sans text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
                Back the AI.
                <br />
                Win if it&apos;s <span className="text-emerald-400">right</span>.
              </h1>
              <p className="mt-5 max-w-xl font-sans text-sm leading-relaxed text-gray-400 sm:text-base">
                ORA is an on-chain AI that reads every World Cup market and calls its pick. Tap once to back it
                with a live-data research read—or open a real WHISTL escrow pact. Every ORA decision is inscribed
                on Solana and every result is checked against TxLINE. No black box, no admin.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/markets" className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90">
                  Browse markets →
                </Link>
                <Link href="/ora" className="rounded-lg border border-white/15 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/5">
                  Meet ORA →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Meet ORA — advert (no betting on the landing) */}
        <section id="ora" className="border-b border-white/10">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 px-3 py-1 text-[10px] uppercase tracking-wider text-emerald-400">
                  <Brain className="size-3.5" /> Meet ORA
                </div>
                <h2 className="font-sans text-3xl font-bold leading-tight text-white sm:text-4xl">
                  An AI trader with a <span className="text-emerald-400">glass skull</span>.
                </h2>
                <p className="mt-4 max-w-xl font-sans text-sm leading-relaxed text-gray-400 sm:text-base">
                  ORA reads every World Cup market and names its pick · the outcome its model rates highest,
                  with a transparent risk mandate. Every decision and refusal is inscribed on Solana, while real
                  escrow settlement lives in WHISTL. No black box. No admin. Flip on
                  <span className="text-emerald-300"> AI predictions</span> in the markets and ORA prices the whole board for you.
                </p>
                <div className="mt-7 grid max-w-lg grid-cols-3 gap-3">
                  {[
                    ["Reads the board", "Fair value from live TxLINE odds"],
                    ["Refuses bad trades", "4% minimum edge · hard exposure limits"],
                    ["Proves it", "Solana decision + TxLINE result + escrow path"],
                  ].map(([t, d]) => (
                    <div key={t} className="rounded-lg border border-white/10 bg-[#0a0a0a] p-3">
                      <p className="text-[11px] font-bold text-white">{t}</p>
                      <p className="mt-1 text-[10px] leading-snug text-gray-500">{d}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/markets" className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-black hover:opacity-90">
                    See ORA price the markets →
                  </Link>
                  <Link href="/ora" className="rounded-lg border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/5">
                    ORA command center
                  </Link>
                </div>
              </div>
              <div className="flex justify-center lg:justify-end">
                <OraLiveCard />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-white/10">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-gray-500">How it works</h2>
            <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/5 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="bg-[#0a0a0a] p-6">
                  <div className="flex items-center gap-2 text-emerald-400">{s.icon}<span className="text-sm font-bold">{s.n}</span></div>
                  <h3 className="mt-4 font-sans text-lg font-semibold text-white">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{s.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/ora" className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-400 hover:bg-emerald-500/15">
                Build your own AI strategy <ArrowRight className="size-4" />
              </Link>
              <Link href="/portfolio" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                My predictions <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-1.5 font-bold tracking-widest text-white">
            <ShieldCheck className="size-3.5 text-emerald-500" /> TxAGENT DESK
          </span>
          <p>No oracle. No admin. Settled by proof.</p>
          <p>World Cup 2026 Hackathon · Powered by TxLINE</p>
        </div>
      </footer>
    </div>
  );
}
