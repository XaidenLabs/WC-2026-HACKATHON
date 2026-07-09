"use client";

import Link from "next/link";
import { ArrowLeft, Brain, Radio } from "lucide-react";
import Header from "@/components/Header";
import StrategyStudio from "@/components/StrategyStudio";
import AgentLedger from "@/components/AgentLedger";
import OraAutopilot from "@/components/OraAutopilot";

// ORA command center — the global agent hub. Compose + backtest + deploy across every live
// market, and audit ORA's full verifiable P&L (bankroll, equity curve, on-chain call history).
export default function OraCommandCenter() {
  return (
    <div className="min-h-screen bg-[#050505] font-mono text-gray-300">
      <Header tagline="verifiable AI counterparty" />
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white">
          <ArrowLeft className="size-4" /> Home
        </Link>

        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <Brain className="size-5" />
          </div>
          <div>
            <h1 className="font-sans text-2xl font-bold text-white">ORA · Command Center</h1>
            <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-gray-400">
              The always-on AI counterparty. Arm the autopilot and ORA trades its value model on its own,
              or compose your own strategy and deploy it. Every decision is inscribed on Solana and settled
              by a TxLINE proof, a glass-skull track record nobody can edit.
            </p>
          </div>
        </div>

        {/* Autonomy: ORA trading itself, the headline capability */}
        <div className="mb-8">
          <OraAutopilot />
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section>
            <StrategyStudio />
          </section>
          <section className="lg:sticky lg:top-4 lg:self-start">
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500">
              <Radio className="size-3 text-emerald-400" /> On-chain agent ledger
            </div>
            <AgentLedger />
          </section>
        </div>
      </div>
    </div>
  );
}
