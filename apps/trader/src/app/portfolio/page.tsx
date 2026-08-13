"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Radio, Wallet } from "lucide-react";
import TraderShell from "@/components/TraderShell";
import AgentLedger from "@/components/AgentLedger";
import { cn } from "@/lib/ui";
import { useTraderWallet, type Position } from "@/hooks/useTraderWallet";

const SEL: Record<string, string> = { home: "Home", draw: "Draw", away: "Away" };
type RecordFilter = "active" | "all" | "lost" | "won";

const RECORD_FILTERS: ReadonlyArray<{ id: RecordFilter; label: string }> = [
  { id: "active", label: "Active" },
  { id: "all", label: "All" },
  { id: "lost", label: "Lost" },
  { id: "won", label: "Won" },
];

const EMPTY_MESSAGES: Record<RecordFilter, string> = {
  active: "No active bets right now.",
  all: "No bets have been placed yet.",
  lost: "No lost bets.",
  won: "No won bets yet.",
};

// Every live-data sandbox position the signed-in user has placed, each linking to its own
// shareable prediction page.
export default function Portfolio() {
  const { ready, authenticated, login, wallet, email, loadingWallet } = useTraderWallet();
  const [filter, setFilter] = useState<RecordFilter>("active");
  const positions = wallet?.positions ?? [];
  const counts: Record<RecordFilter, number> = {
    active: positions.filter((position) => position.status === "open").length,
    all: positions.length,
    lost: positions.filter((position) => position.status === "lost").length,
    won: positions.filter((position) => position.status === "won").length,
  };
  const filteredPositions = positions.filter((position) => {
    if (filter === "all") return true;
    if (filter === "active") return position.status === "open";
    return position.status === filter;
  });

  return (
    <TraderShell title="Record" subtitle="Positions, outcomes, and unique ORA decision receipts.">
      <div className="terminal-workspace mx-auto w-full max-w-4xl font-mono">
        {ready && !authenticated ? (
          <div className="telemetry-panel p-8 text-center">
            <Wallet className="mx-auto size-6 text-[#ff650f]" />
            <p className="mt-3 text-sm text-[#85877f]">Sign in to see your live-data sandbox positions and test USDC balance.</p>
            <button onClick={login} className="mt-4 bg-[#ff650f] px-4 py-2 text-xs font-bold text-[#0a0b09] hover:bg-[#ff7a2f]">
              Sign in with email
            </button>
          </div>
        ) : (
          <>
            {/* Wallet summary */}
            <div className="telemetry-panel p-5">
              <p className="text-[10px] uppercase tracking-wider text-[#686a64]">Live-data sandbox</p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-[#ff650f]">
                {wallet ? wallet.balance.toFixed(2) : "..."} <span className="text-sm font-normal text-[#686a64]">test USDC</span>
              </p>
              <p className="mt-2 text-[11px] text-[#686a64]">
                {email}
                {wallet ? ` | ${wallet.wins}W / ${wallet.settled} settled | ${wallet.open} open | ` : " | "}
                {wallet && <span className={wallet.netPnl >= 0 ? "text-[#4ee58a]" : "text-[#ff765f]"}>{wallet.netPnl >= 0 ? "+" : ""}{wallet.netPnl} P&amp;L</span>}
              </p>
            </div>

            <section className="mt-6" aria-labelledby="bet-record-heading">
              <h2 id="bet-record-heading" className="text-[10px] uppercase tracking-wider text-[#686a64]">Bets</h2>

              <div className="mt-3 overflow-x-auto border-b border-[#292b25]">
                <div className="flex min-w-max" role="tablist" aria-label="Filter betting record">
                  {RECORD_FILTERS.map((recordFilter) => {
                    const selected = filter === recordFilter.id;
                    const isActiveFilter = recordFilter.id === "active";

                    return (
                      <button
                        key={recordFilter.id}
                        id={`record-tab-${recordFilter.id}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls="bet-record-panel"
                        onClick={() => setFilter(recordFilter.id)}
                        className={cn(
                          "relative flex min-h-11 items-center gap-2 px-4 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ff650f]",
                          selected ? "text-[#efefeb]" : "text-[#686a64] hover:text-[#a7a9a2]",
                          selected && "after:absolute after:inset-x-0 after:bottom-[-1px] after:h-px after:bg-[#ff650f]",
                        )}
                      >
                        {recordFilter.label}
                        <span
                          className={cn(
                            "min-w-5 px-1.5 py-0.5 text-center text-[10px] tabular-nums",
                            isActiveFilter
                              ? "bg-[#123020] text-[#4ee58a]"
                              : selected
                                ? "bg-[#24251f] text-[#c7c8c2]"
                                : "bg-[#171816] text-[#686a64]",
                          )}
                        >
                          {counts[recordFilter.id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {loadingWallet ? (
                <div id="bet-record-panel" role="tabpanel" aria-labelledby={`record-tab-${filter}`} className="border border-t-0 border-[#292b25] p-8 text-center text-sm text-[#686a64]">
                  Loading bets...
                </div>
              ) : filteredPositions.length === 0 ? (
                <div id="bet-record-panel" role="tabpanel" aria-labelledby={`record-tab-${filter}`} className="border border-t-0 border-dashed border-[#30322c] p-8 text-center text-sm text-[#686a64]">
                  {EMPTY_MESSAGES[filter]}{" "}
                  <Link href="/markets" className="text-[#ff7a2f] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff650f]">
                    Open a market
                  </Link>
                  {filter === "all" ? " to place your first bet." : " to find another trade."}
                </div>
              ) : (
                <div id="bet-record-panel" role="tabpanel" aria-labelledby={`record-tab-${filter}`} className="mt-3 space-y-2">
                  {filteredPositions.map((p) => <PositionCard key={p.id} p={p} />)}
                </div>
              )}
            </section>

          </>
        )}

        <section className="mt-10 border-t border-[#292b25] pt-6" aria-labelledby="ora-decision-record-heading">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="ora-decision-record-heading" className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#686a64]">
                <Radio className="size-3 text-[#4ee58a]" /> ORA decisions
              </h2>
              <p className="mt-2 text-[11px] leading-5 text-[#686a64]">Unique public calls and passes, identified by their Solana receipt.</p>
            </div>
          </div>
          <div className="terminal-ledger mt-4"><AgentLedger /></div>
        </section>
      </div>
    </TraderShell>
  );
}

function PositionCard({ p }: { p: Position }) {
  const won = p.status === "won";
  const lost = p.status === "lost";
  return (
    <Link href={`/prediction/${p.id}`}
      className={cn("flex items-center justify-between gap-3 border p-4 transition-colors hover:bg-[#171816]",
        won ? "border-[#1f4a35] bg-[#0d1711]" : lost ? "border-[#4e2924] bg-[#190f0d]" : "border-[#292b25] bg-[#11120f]")}>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[#efefeb]">{p.match}</p>
        <p className="mt-0.5 text-[11px] text-[#686a64]">{SEL[p.selection]} @ {p.odds.toFixed(2)}x | {p.stake} test USDC</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold",
          won ? "bg-[#123020] text-[#4ee58a]" : lost ? "bg-[#321713] text-[#ff765f]" : "bg-[#20211e] text-[#8a8c85]")}>
          {won ? `WON ${p.finalScore ?? ""}` : lost ? `LOST ${p.finalScore ?? ""}` : "OPEN"}
        </span>
        {p.pnl != null && (
          <span className={cn("font-mono text-sm font-bold", p.pnl >= 0 ? "text-[#4ee58a]" : "text-[#ff765f]")}>
            {p.pnl >= 0 ? "+" : ""}{p.pnl}
          </span>
        )}
        <ArrowRight className="size-4 text-[#5f615b]" />
      </div>
    </Link>
  );
}
