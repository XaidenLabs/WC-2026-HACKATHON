"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ChevronRight, Loader2, Search, Sparkles } from "lucide-react";
import { useTraderWallet } from "@/hooks/useTraderWallet";

type Cycle = {
  ok: boolean;
  proposal?: { id: string; match: string; selection: string; quotedOdds: number; evPct: number } | null;
  scan?: { fixturesFound: number; fixturesPriced: number; qualified: number };
  error?: string;
};

type Finding = { title: string; detail: string; tone: "neutral" | "positive" | "quiet" };

export default function OraAutopilot({ onCycle }: { onCycle?: () => void }) {
  const { authenticated, login, getAccessToken } = useTraderWallet();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runScan() {
    if (!authenticated) { login(); return; }
    if (busy) return;
    setBusy(true);
    setError(null);
    setFindings([]);
    setStep(1);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/trader/proposals", {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `ora-ui:${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ stake: 20 }),
      });
      setStep(2);
      const cycle = await response.json() as Cycle;
      if (!response.ok || !cycle.ok) throw new Error(cycle.error ?? "The scan could not finish.");
      setStep(3);
      const scan = cycle.scan;
      const next: Finding[] = [
        {
          title: `Checked ${scan?.fixturesFound ?? 0} games`,
          detail: `${scan?.fixturesPriced ?? 0} had enough live information for a fair comparison.`,
          tone: "neutral",
        },
      ];
      if (cycle.proposal) {
        next.push({
          title: cycle.proposal.match,
          detail: `${cycle.proposal.selection} at ${cycle.proposal.quotedOdds.toFixed(2)}. ORA found a ${cycle.proposal.evPct}% value advantage.`,
          tone: "positive",
        });
      } else {
        next.push({
          title: "No strong pick right now",
          detail: "ORA found possible outcomes, but none had a price good enough to risk your balance.",
          tone: "quiet",
        });
      }
      setFindings(next);
      onCycle?.();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const steps = ["Checking today’s games", "Comparing likely outcomes", "Looking for useful prices"];

  return (
    <section className="border border-[#2b2d27] bg-[#11120f]" aria-labelledby="ora-scan-title">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(320px,1.15fr)]">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#ff650f]">
            <Sparkles className="size-3.5" /> ORA scan
          </span>
          <h2 id="ora-scan-title" className="mt-4 max-w-md text-2xl font-black tracking-[-0.04em] text-[#f1f1ed] sm:text-3xl">
            Find the games worth your attention.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[#8d8f88]">
            ORA checks today’s fixtures, compares likely outcomes with available prices, and only brings you picks that are worth reviewing.
          </p>
          <button type="button" onClick={() => void runScan()} disabled={busy} className="mt-6 inline-flex min-h-11 items-center gap-2 bg-[#ff650f] px-5 text-sm font-black text-[#0a0b09] transition hover:bg-[#ff7a2f] disabled:cursor-wait disabled:opacity-70">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {!authenticated ? "Sign in to scan" : busy ? steps[Math.max(0, step - 1)] : "Start ORA scan"}
          </button>
          <p className="mt-3 text-xs text-[#63655f]">A scan does not place a pick. You review the result first.</p>
        </div>

        <div className="border border-[#262822] bg-[#0c0d0b] p-4 sm:p-5">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-[#686a64]">What ORA finds</p>
          {busy && (
            <ol className="mt-5 space-y-4">
              {steps.map((label, index) => {
                const number = index + 1;
                const complete = step > number;
                const active = step === number;
                return <li key={label} className={`flex items-center gap-3 text-sm ${complete ? "text-[#4ee58a]" : active ? "text-[#efefeb]" : "text-[#555751]"}`}>
                  {complete ? <CheckCircle2 className="size-4" /> : active ? <Loader2 className="size-4 animate-spin text-[#ff650f]" /> : <span className="grid size-4 place-items-center border border-[#363832] font-mono text-[8px]">{number}</span>}
                  {label}
                </li>;
              })}
            </ol>
          )}
          {!busy && findings.length === 0 && !error && <p className="mt-5 text-sm leading-6 text-[#666861]">Your scan results will appear here in plain language.</p>}
          {!busy && findings.length > 0 && (
            <div className="mt-4 space-y-2">
              {findings.map((finding) => <article key={finding.title} className={`border p-4 ${finding.tone === "positive" ? "border-[#1f4a35] bg-[#0d1711]" : "border-[#292b25] bg-[#121310]"}`}>
                <p className={`text-sm font-bold ${finding.tone === "positive" ? "text-[#4ee58a]" : "text-[#e1e2dd]"}`}>{finding.title}</p>
                <p className="mt-2 text-xs leading-5 text-[#85877f]">{finding.detail}</p>
              </article>)}
              {findings.some((finding) => finding.tone === "positive") && <Link href="/dashboard#supervised-execution" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#ff650f] hover:text-[#ff8a49]">Review this pick <ChevronRight className="size-3.5" /></Link>}
            </div>
          )}
          {error && <div role="alert" className="mt-4 border border-[#552c25] bg-[#1b100d] p-3 text-xs leading-5 text-[#ff8b78]">{error}</div>}
        </div>
      </div>
    </section>
  );
}
