"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Download,
  LogIn,
  Play,
  Sparkles,
  Wallet,
} from "lucide-react";
import AgentLedger from "@/components/AgentLedger";
import OraCalendarHome from "@/components/OraCalendarHome";
import SupervisedExecutionPanel from "@/components/SupervisedExecutionPanel";
import TraderShell from "@/components/TraderShell";
import { useTraderWallet } from "@/hooks/useTraderWallet";
import type { TradeProposal, TradingMandate } from "@/lib/supervision/domain";

type SupervisionSnapshot = {
  mandate: TradingMandate;
  proposals: TradeProposal[];
};

export default function OraDashboard() {
  const { ready, authenticated, login, wallet, getAccessToken, mutateWallet } = useTraderWallet();
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [supervision, setSupervision] = useState<SupervisionSnapshot | null>(null);
  const queuedScanHandled = useRef(false);

  const pendingProposals = useMemo(
    () => supervision?.proposals.filter((proposal) => proposal.status === "pending").length ?? 0,
    [supervision],
  );

  const runScan = useCallback(() => {
    const trigger = document.getElementById("run-ora-scan") as HTMLButtonElement | null;
    if (!trigger || trigger.disabled) {
      setScanNotice("ORA scan is unavailable until the mandate finishes loading.");
      return;
    }
    trigger.click();
    document.getElementById("supervised-execution")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScanNotice("ORA live market scan started.");
  }, []);

  const onSnapshot = useCallback((snapshot: SupervisionSnapshot) => {
    setSupervision(snapshot);
  }, []);

  useEffect(() => {
    if (!supervision || queuedScanHandled.current || new URLSearchParams(window.location.search).get("scan") !== "1") return;
    queuedScanHandled.current = true;
    const timer = window.setTimeout(runScan, 0);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    return () => window.clearTimeout(timer);
  }, [runScan, supervision]);

  return (
    <TraderShell title="Today" subtitle="Games, ORA picks, and your activity in one place." onRunScan={runScan}>
      {!ready ? (
        <DashboardSkeleton />
      ) : !authenticated ? (
        <section className="telemetry-panel mx-auto max-w-xl p-8 sm:p-12">
          <span className="grid size-12 place-items-center bg-[#ff650f] text-[#0a0b09]"><LogIn className="size-5" /></span>
          <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-[#ff650f]">Your football assistant</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#f1f1ed]">Sign in and let ORA start watching.</h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-[#85877f]">See today’s games, review possible picks, set your limits, and follow every result.</p>
          <button onClick={login} className="mt-8 inline-flex min-h-11 items-center gap-2 bg-[#ff650f] px-5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#0a0b09] transition hover:bg-[#ff7a2f] active:translate-y-px">
            Sign in with email <ChevronRight className="size-4" />
          </button>
          <p className="mt-4 font-mono text-[10px] text-[#62645e]">PRACTICE MODE. NO REAL MONEY IS USED.</p>
        </section>
      ) : (
        <>
          {scanNotice && (
            <div role="status" className="mb-4 flex items-center justify-between border border-[#4b2b17] bg-[#17110d] px-4 py-3 font-mono text-[10px] text-[#d59058]">
              <span>{scanNotice}</span>
              <button type="button" onClick={() => setScanNotice(null)} className="text-[#ff650f] hover:text-[#ff8a49]">DISMISS</button>
            </div>
          )}

          <section className="grid gap-px bg-[#252721] sm:grid-cols-2 xl:grid-cols-4" aria-label="Account telemetry">
            <TelemetryMetric label="Practice balance" value={wallet ? wallet.balance.toFixed(2) : "..."} unit="credits" accent="orange" sub={`${wallet?.netPnl && wallet.netPnl > 0 ? "+" : ""}${wallet?.netPnl?.toFixed(2) ?? "0.00"} overall result`} />
            <TelemetryMetric label="Open picks" value={String(wallet?.open ?? 0)} unit="games" sub={`${wallet?.settled ?? 0} completed`} />
            <TelemetryMetric label="Waiting for you" value={String(pendingProposals)} unit="picks" accent={pendingProposals > 0 ? "orange" : "green"} sub="Approve or decline within five minutes" />
            <TelemetryMetric label="ORA status" value={supervision?.mandate.killed ? "STOPPED" : supervision?.mandate.paused ? "PAUSED" : supervision?.mandate.autoExecute ? "WATCHING" : "REVIEW"} unit="mode" accent={supervision?.mandate.autoExecute && !supervision.mandate.paused && !supervision.mandate.killed ? "green" : "orange"} sub={`Up to ${supervision?.mandate.maxStake ?? 0} credits per pick`} />
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-4">
              <section id="supervised-execution" className="scroll-mt-24">
                <SupervisedExecutionPanel getAccessToken={getAccessToken} onExecution={() => void mutateWallet()} onSnapshot={onSnapshot} />
              </section>

              <section className="telemetry-panel overflow-hidden" aria-labelledby="market-calendar-title">
                <div className="flex items-center justify-between border-b border-[#252721] px-4 py-3">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#686a64]">Market calendar</p>
                    <h2 id="market-calendar-title" className="mt-1 text-sm font-bold text-[#efefeb]">What ORA is watching today</h2>
                  </div>
                  <Link href="/markets" className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#ff650f] hover:text-[#ff8a49]">All games <ChevronRight className="size-3" /></Link>
                </div>
                <div className="ora-calendar-terminal p-3 sm:p-4">
                  <OraCalendarHome embedded showLedger={false} />
                </div>
              </section>

              <RecentPositions positions={wallet?.positions ?? []} />
            </div>

            <aside className="space-y-4 xl:sticky xl:top-[92px] xl:h-fit">
              <section className="telemetry-panel p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#686a64]">Balance and ORA limits</p>
                    <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#ff650f]">{wallet?.balance.toFixed(2) ?? "..."}</p>
                    <p className="font-mono text-[9px] text-[#686a64]">PRACTICE CREDITS</p>
                  </div>
                  <Wallet className="size-6 text-[#ff650f]" strokeWidth={1.6} />
                </div>
                <dl className="mt-5 space-y-px bg-[#252721] font-mono text-[10px]">
                  <StatusRow label="Account" value="PRACTICE" tone="green" />
                  <StatusRow label="Auto-pick" value={supervision?.mandate.autoExecute ? "ON" : "OFF"} tone={supervision?.mandate.autoExecute ? "green" : "muted"} />
                  <StatusRow label="ORA" value={supervision?.mandate.killed ? "STOPPED" : supervision?.mandate.paused ? "PAUSED" : "READY"} tone={supervision?.mandate.killed ? "orange" : "green"} />
                  <StatusRow label="Markets" value={(supervision?.mandate.allowedMarkets ?? ["1x2"]).join(", ").toUpperCase()} />
                </dl>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link href="/wallet" className="inline-flex min-h-10 items-center justify-center bg-[#ff650f] font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#0a0b09] hover:bg-[#ff7a2f]">Manage funds</Link>
                  <Link href="/portfolio" className="inline-flex min-h-10 items-center justify-center border border-[#30322c] bg-[#171816] font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#8c8e87] hover:text-[#efefeb]">View history</Link>
                </div>
              </section>

              <section className="telemetry-panel p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#686a64]">Latest ORA activity</p>
                  <Sparkles className="size-4 text-[#ff650f]" />
                </div>
                <div className="terminal-ledger"><AgentLedger limit={2} /></div>
              </section>

              <section className="telemetry-panel p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#686a64]">Quick actions</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <QuickAction label="Run scan" icon={Play} onClick={runScan} primary />
                  <QuickAction label="Export" icon={Download} href="/portfolio" />
                  <QuickAction label="Games" icon={CalendarDays} href="/markets" />
                  <QuickAction label="Alerts" icon={BellRing} href="/ora" />
                </div>
              </section>

              <section className="border border-[#4b2b17] bg-[#17110d] p-4">
                <div className="flex gap-3">
                  <CircleDollarSign className="mt-0.5 size-5 shrink-0 text-[#ff650f]" />
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#ff7a2f]">Testing environment</p>
                    <p className="mt-2 font-mono text-[9px] leading-5 text-[#87654f]">Production deposits and autonomous real-money execution are not enabled.</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </TraderShell>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="grid gap-px bg-[#252721] sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse bg-[#11120f]" />)}
      </div>
      <div className="mt-4 h-96 animate-pulse bg-[#11120f]" />
    </div>
  );
}

function TelemetryMetric({ label, value, unit, sub, accent = "default" }: { label: string; value: string; unit: string; sub: string; accent?: "default" | "orange" | "green" }) {
  const valueClass = accent === "orange" ? "text-[#ff650f]" : accent === "green" ? "text-[#4ee58a]" : "text-[#efefeb]";
  return (
    <article className="min-h-28 bg-[#11120f] p-4 sm:p-5">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#555751]">{label}</p>
      <p className={`mt-3 font-mono text-2xl font-bold tabular-nums ${valueClass}`}>{value} <span className="text-[9px] font-normal uppercase text-[#61635d]">{unit}</span></p>
      <p className="mt-2 font-mono text-[9px] text-[#676963]">{sub}</p>
    </article>
  );
}

function StatusRow({ label, value, tone = "muted" }: { label: string; value: string; tone?: "muted" | "green" | "orange" }) {
  const toneClass = tone === "green" ? "text-[#4ee58a]" : tone === "orange" ? "text-[#ff650f]" : "text-[#8a8c85]";
  return <div className="flex items-center justify-between bg-[#11120f] px-3 py-2.5"><dt className="text-[#595b55]">{label}</dt><dd className={toneClass}>{value}</dd></div>;
}

function QuickAction({ label, icon: Icon, href, onClick, primary = false }: { label: string; icon: typeof Play; href?: string; onClick?: () => void; primary?: boolean }) {
  const className = `inline-flex min-h-10 items-center justify-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.06em] transition active:translate-y-px ${primary ? "bg-[#ff650f] text-[#0a0b09] hover:bg-[#ff7a2f]" : "border border-[#292b25] bg-[#171816] text-[#777972] hover:border-[#44463f] hover:text-[#efefeb]"}`;
  if (href) return <Link href={href} className={className}><Icon className="size-3" /> {label}</Link>;
  return <button type="button" onClick={onClick} className={className}><Icon className="size-3" /> {label}</button>;
}

function RecentPositions({ positions }: { positions: NonNullable<ReturnType<typeof useTraderWallet>["wallet"]>["positions"] }) {
  return (
    <section className="telemetry-panel overflow-hidden" aria-labelledby="recent-positions-title">
      <div className="flex items-center justify-between border-b border-[#252721] px-4 py-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#686a64]">Recent positions</p>
          <h2 id="recent-positions-title" className="mt-1 text-sm font-bold text-[#efefeb]">Execution history</h2>
        </div>
        <Link href="/portfolio" className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#ff650f] hover:text-[#ff8a49]">View all</Link>
      </div>
      {positions.length === 0 ? (
        <div className="px-4 py-10 text-center font-mono text-[10px] text-[#5f615b]">No positions yet. Run an ORA scan to test the supervised workflow.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] border-collapse text-left font-mono text-[10px]">
            <thead className="text-[#555751]"><tr><th className="px-4 py-3 font-medium">MATCH</th><th className="px-4 py-3 font-medium">SIDE</th><th className="px-4 py-3 font-medium">PRICE</th><th className="px-4 py-3 font-medium">STAKE</th><th className="px-4 py-3 font-medium">P&amp;L</th><th className="px-4 py-3 text-right font-medium">STATUS</th></tr></thead>
            <tbody>
              {positions.slice(0, 6).map((position) => (
                <tr key={position.id} className="border-t border-[#21231e] text-[#9b9d96] hover:bg-[#151613]">
                  <td className="max-w-[260px] truncate px-4 py-3 text-[#d8d9d4]">{position.match}</td>
                  <td className="px-4 py-3 uppercase">{position.selection}</td>
                  <td className="px-4 py-3 tabular-nums">{position.odds.toFixed(2)}x</td>
                  <td className="px-4 py-3 tabular-nums">{position.stake.toFixed(2)}</td>
                  <td className={`px-4 py-3 tabular-nums ${position.pnl == null ? "text-[#666861]" : position.pnl >= 0 ? "text-[#4ee58a]" : "text-[#ff765f]"}`}>{position.pnl == null ? "OPEN" : `${position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)}`}</td>
                  <td className="px-4 py-3 text-right"><span className={`inline-block border px-2 py-1 uppercase ${position.status === "won" ? "border-[#1f4a35] text-[#4ee58a]" : position.status === "lost" ? "border-[#4e2924] text-[#ff765f]" : "border-[#4b2b17] text-[#ff7a2f]"}`}>{position.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
