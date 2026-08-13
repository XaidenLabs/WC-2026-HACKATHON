"use client";

import { useState } from "react";
import { Bot, CheckCircle2, Loader2, Lock, Play, Send, Sparkles, User } from "lucide-react";
import { useTraderWallet } from "@/hooks/useTraderWallet";
import type { BacktestSummary, StrategySpec } from "@/lib/agent/strategy";
import { actionText, conditionText, marketText } from "@/lib/agent/humanize";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  spec?: StrategySpec;
};

const STARTERS = [
  "Find Over 1.5 goals when the chance is above 70%.",
  "Both teams to score, but only when the price is worth it.",
  "Back the home underdog when the market starts moving towards them.",
  "Look for Under 3.5 goals with a strong probability.",
];

export default function StrategyStudio({ fixtureId, matchLabel, onDeployed }: { fixtureId?: number; matchLabel?: string; onDeployed?: () => void }) {
  const { authenticated, login } = useTraderWallet();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<"test" | "use" | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Tell me how you want ORA to look for games. You can mention the market, probability, price movement, and how much you want to use.",
    },
  ]);

  function add(message: Omit<Message, "id">) {
    setMessages((current) => [...current, { ...message, id: crypto.randomUUID() }]);
  }

  async function sendRule() {
    const text = input.trim();
    if (!text || busy) return;
    if (!authenticated) { login(); return; }
    setInput("");
    add({ role: "user", text });
    setBusy(true);
    try {
      const response = await fetch("/api/agent/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        add({ role: "assistant", text: body.message ?? body.error ?? "I could not turn that into a safe rule. Try saying the market and condition more clearly." });
        return;
      }
      add({
        role: "assistant",
        text: "Here is the rule I understood. Check it before you test or use it.",
        spec: body.spec,
      });
    } catch (caught) {
      add({ role: "assistant", text: `I could not finish that rule: ${(caught as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function runAction(spec: StrategySpec, action: "test" | "use") {
    if (spec.market !== "1X2") {
      add({
        role: "assistant",
        text: `${marketText(spec)} is already part of ORA’s normal scan. Custom testing for this market is being connected next, so I will not show you a made-up result.`,
      });
      return;
    }
    setActionBusy(action);
    try {
      const response = await fetch(action === "test" ? "/api/agent/backtest" : "/api/agent/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "test" ? { spec } : { spec, fixtureId }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "The request could not finish.");
      if (action === "test") {
        const result = body.summary as BacktestSummary;
        add({
          role: "assistant",
          text: result.count
            ? `I tested this on ${body.matchesScanned} completed games. It made ${result.count} picks, won ${result.wins}, and finished ${result.pnl >= 0 ? "up" : "down"} ${Math.abs(result.pnl).toFixed(2)} practice credits. A small test is not proof of future performance.`
            : `I checked ${body.matchesScanned} completed games, but none matched this exact rule.`,
        });
      } else {
        add({
          role: "assistant",
          text: body.inscribed > 0
            ? `The rule found ${body.inscribed} pick${body.inscribed === 1 ? "" : "s"}${matchLabel ? ` for ${matchLabel}` : ""}. You can review them in History.`
            : "The rule is ready, but no current game matched it. ORA did not force a pick.",
        });
        onDeployed?.();
      }
    } catch (caught) {
      add({ role: "assistant", text: `That did not finish safely: ${(caught as Error).message}` });
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <section className="border border-[#2b2d27] bg-[#11120f]" aria-labelledby="strategy-chat-title">
      <header className="border-b border-[#292b25] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center bg-[#25170e] text-[#ff650f]"><Sparkles className="size-4" /></span>
          <div>
            <h2 id="strategy-chat-title" className="text-base font-black text-[#f0f0ec]">Build a rule with ORA</h2>
            <p className="mt-1 text-xs text-[#74766f]">Describe it like you would explain it to a friend.</p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[540px] max-w-3xl flex-col">
        <div className="flex-1 space-y-5 p-4 sm:p-6" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && <span className="grid size-8 shrink-0 place-items-center bg-[#25170e] text-[#ff650f]"><Bot className="size-4" /></span>}
              <div className={`max-w-[86%] ${message.role === "user" ? "bg-[#ff650f] text-[#0a0b09]" : "border border-[#2c2e28] bg-[#151613] text-[#d8d9d4]"} px-4 py-3`}>
                <p className="text-sm leading-6">{message.text}</p>
                {message.spec && <RuleCard spec={message.spec} busy={actionBusy} onAction={runAction} />}
              </div>
              {message.role === "user" && <span className="grid size-8 shrink-0 place-items-center border border-[#4b2b17] bg-[#17110d] text-[#ff650f]"><User className="size-4" /></span>}
            </div>
          ))}
          {busy && <div className="flex items-center gap-3 text-sm text-[#85877f]"><span className="grid size-8 place-items-center bg-[#25170e] text-[#ff650f]"><Loader2 className="size-4 animate-spin" /></span>ORA is turning that into a clear rule...</div>}
        </div>

        <div className="border-t border-[#292b25] p-4 sm:p-5">
          {messages.length === 1 && <div className="mb-3 flex flex-wrap gap-2">{STARTERS.map((starter) => <button key={starter} type="button" onClick={() => setInput(starter)} className="border border-[#30322c] bg-[#171816] px-3 py-2 text-left text-[11px] text-[#969891] transition hover:border-[#ff650f] hover:text-[#efefeb]">{starter}</button>)}</div>}
          <div className="flex items-end gap-2 border border-[#393b34] bg-[#0c0d0b] p-2 focus-within:border-[#ff650f]">
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendRule(); } }} rows={2} placeholder="Example: Find Over 2.5 goals when both teams have been scoring regularly..." className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 text-[#efefeb] outline-none placeholder:text-[#555751]" />
            <button type="button" onClick={() => void sendRule()} disabled={busy || !input.trim()} aria-label="Send rule" className="grid size-10 shrink-0 place-items-center bg-[#ff650f] text-[#0a0b09] transition hover:bg-[#ff7a2f] disabled:opacity-40">{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</button>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-[#5f615b]">ORA can compile Match Result, Goal Totals, and Both Teams to Score. It will tell you when a requested market is not safely supported yet.</p>
        </div>
      </div>
    </section>
  );
}

function RuleCard({ spec, busy, onAction }: { spec: StrategySpec; busy: "test" | "use" | null; onAction: (spec: StrategySpec, action: "test" | "use") => Promise<void> }) {
  return (
    <div className="mt-4 border border-[#3a3c35] bg-[#0c0d0b] p-4 text-[#d8d9d4]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[#f1f1ed]">{spec.name}</p>
          <p className="mt-1 text-xs text-[#ff7a2f]">{marketText(spec)}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4ee58a]"><CheckCircle2 className="size-3" /> Understood</span>
      </div>
      <dl className="mt-4 space-y-2 text-xs">
        <div className="flex gap-3"><dt className="w-16 shrink-0 text-[#666861]">Look for</dt><dd>{conditionText(spec)}</dd></div>
        <div className="flex gap-3"><dt className="w-16 shrink-0 text-[#666861]">Then</dt><dd>{actionText(spec)}</dd></div>
        <div className="flex gap-3"><dt className="w-16 shrink-0 text-[#666861]">Amount</dt><dd>{spec.stake} practice credits per pick</dd></div>
      </dl>
      <p className="mt-4 border-l-2 border-[#ff650f] pl-3 text-xs leading-5 text-[#8f918a]">{spec.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void onAction(spec, "test")} disabled={busy != null} className="inline-flex min-h-9 items-center gap-2 border border-[#3b3d36] px-3 text-xs font-bold text-[#d4d5d0] hover:border-[#ff650f] disabled:opacity-50">{busy === "test" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Test this rule</button>
        <button type="button" onClick={() => void onAction(spec, "use")} disabled={busy != null} className="inline-flex min-h-9 items-center gap-2 bg-[#ff650f] px-3 text-xs font-black text-[#0a0b09] hover:bg-[#ff7a2f] disabled:opacity-50">{busy === "use" ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />} Use this rule</button>
      </div>
    </div>
  );
}
