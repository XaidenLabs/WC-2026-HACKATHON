"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, SlidersHorizontal, UserRound } from "lucide-react";
import { useTraderWallet } from "@/hooks/useTraderWallet";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { MARKET_LABELS, type MarketPreference, type UserPreferences } from "@/lib/profile/preferences";

const MARKET_OPTIONS = Object.entries(MARKET_LABELS) as [MarketPreference, string][];

export default function ProfileSettings() {
  const { email, userId } = useTraderWallet();
  const { preferences, loaded, save } = useUserPreferences(userId);
  const [draft, setDraft] = useState<UserPreferences>(preferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    const task = window.setTimeout(() => setDraft(preferences), 0);
    return () => window.clearTimeout(task);
  }, [loaded, preferences]);

  function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function toggleMarket(market: MarketPreference) {
    const exists = draft.preferredMarkets.includes(market);
    const next = exists ? draft.preferredMarkets.filter((item) => item !== market) : [...draft.preferredMarkets, market];
    update("preferredMarkets", next.length ? next : [market]);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(draft);
    setSaved(true);
  }

  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[0.75fr_1.25fr]">
      <section className="border border-[#252721] bg-[#11120f] p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center bg-[#25170e] text-[#ff650f]">
            <UserRound className="size-5" />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#ff650f]">Profile</p>
            <h2 className="text-xl font-black tracking-[-0.03em] text-[#efefeb]">Account identity</h2>
          </div>
        </div>

        <label className="mt-6 block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#686a64]">Account name</span>
          <input
            value={draft.displayName}
            onChange={(event) => update("displayName", event.target.value)}
            placeholder="What should TXAgent call you?"
            className="mt-2 h-12 w-full border border-[#30322c] bg-[#0d0e0c] px-3 text-sm text-[#efefeb] outline-none transition placeholder:text-[#565852] focus:border-[#ff650f]"
          />
        </label>

        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#686a64]">Signed-in email</p>
          <p className="mt-2 border border-[#252721] bg-[#0d0e0c] px-3 py-3 text-sm text-[#d0d1cc]">{email ?? "Email unavailable"}</p>
        </div>

        <div className="mt-5 border border-[#4b2b17] bg-[#17110d] p-4">
          <p className="text-sm font-bold text-[#efefeb]">Clean by default</p>
          <p className="mt-2 text-sm leading-6 text-[#8c8e87]">
            Complex controls live here first. The main screens stay focused on games, picks, and decisions.
          </p>
        </div>
      </section>

      <section className="grid gap-5">
        <div className="border border-[#252721] bg-[#11120f] p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center bg-[#25170e] text-[#ff650f]">
              <SlidersHorizontal className="size-5" />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#ff650f]">Preferences</p>
              <h2 className="text-xl font-black tracking-[-0.03em] text-[#efefeb]">How ORA should behave</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ToggleCard
              title="Show Ask ORA"
              body="Adds the advanced chat and rule-builder page to the sidebar."
              checked={draft.showAskOra}
              onChange={(checked) => update("showAskOra", checked)}
            />
            <ToggleCard
              title="Compact mode"
              body="Keeps the app screens tighter so casual users see less noise."
              checked={draft.compactMode}
              onChange={(checked) => update("compactMode", checked)}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#686a64]">Auto-pick rule</span>
              <select value={draft.autoPickMode} onChange={(event) => update("autoPickMode", event.target.value as UserPreferences["autoPickMode"])} className="mt-2 h-12 w-full border border-[#30322c] bg-[#0d0e0c] px-3 text-sm text-[#efefeb] outline-none focus:border-[#ff650f]">
                <option value="review_first">Ask me first</option>
                <option value="auto_after_timer">Auto after timer</option>
                <option value="manual_only">Manual only</option>
              </select>
            </label>

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#686a64]">Review window</span>
              <select value={draft.reviewWindowMinutes} onChange={(event) => update("reviewWindowMinutes", Number(event.target.value))} className="mt-2 h-12 w-full border border-[#30322c] bg-[#0d0e0c] px-3 text-sm text-[#efefeb] outline-none focus:border-[#ff650f]">
                <option value={2}>2 minutes</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
              </select>
            </label>

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#686a64]">Default stake</span>
              <select value={draft.defaultStake} onChange={(event) => update("defaultStake", Number(event.target.value))} className="mt-2 h-12 w-full border border-[#30322c] bg-[#0d0e0c] px-3 text-sm text-[#efefeb] outline-none focus:border-[#ff650f]">
                <option value={25}>25 practice credits</option>
                <option value={50}>50 practice credits</option>
                <option value={100}>100 practice credits</option>
                <option value={250}>250 practice credits</option>
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="border border-[#252721] bg-[#11120f] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#ff650f]">Markets</p>
            <h3 className="mt-2 text-xl font-black text-[#efefeb]">Angles ORA should prioritize</h3>
            <div className="mt-5 grid gap-2">
              {MARKET_OPTIONS.map(([market, label]) => (
                <label key={market} className="flex cursor-pointer items-center justify-between border border-[#252721] bg-[#0d0e0c] px-3 py-3 text-sm text-[#d0d1cc] transition hover:border-[#ff650f]/60">
                  <span>{label}</span>
                  <input type="checkbox" checked={draft.preferredMarkets.includes(market)} onChange={() => toggleMarket(market)} className="size-4 accent-[#ff650f]" />
                </label>
              ))}
            </div>
          </div>

          <div className="border border-[#252721] bg-[#11120f] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#ff650f]">Data mode</p>
            <h3 className="mt-2 text-xl font-black text-[#efefeb]">Where ORA should look first</h3>
            <div className="mt-5 grid gap-2">
              {[
                ["txline_first", "TXLine first"],
                ["sportmonks_first", "Sportmonks first"],
                ["both", "Use both when available"],
              ].map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center justify-between border border-[#252721] bg-[#0d0e0c] px-3 py-3 text-sm text-[#d0d1cc] transition hover:border-[#ff650f]/60">
                  <span>{label}</span>
                  <input type="radio" name="data-mode" checked={draft.dataMode === value} onChange={() => update("dataMode", value as UserPreferences["dataMode"])} className="size-4 accent-[#ff650f]" />
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-3 z-10 flex flex-col gap-3 border border-[#252721] bg-[#0a0b09]/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-5 text-sm text-[#8c8e87]">
            {saved ? <span className="inline-flex items-center gap-2 text-[#4ee58a]"><CheckCircle2 className="size-4" /> Preferences saved.</span> : "Save changes to update your TXAgent workspace."}
          </p>
          <button type="submit" className="min-h-11 bg-[#ff650f] px-5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#0a0b09] transition hover:bg-[#ff7a2f]">
            Save profile
          </button>
        </div>
      </section>
    </form>
  );
}

function ToggleCard({ title, body, checked, onChange }: { title: string; body: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border border-[#252721] bg-[#0d0e0c] p-4 transition hover:border-[#ff650f]/60">
      <span>
        <span className="block text-sm font-black text-[#efefeb]">{title}</span>
        <span className="mt-2 block text-sm leading-6 text-[#8c8e87]">{body}</span>
      </span>
      <span className={`relative mt-1 h-5 w-9 shrink-0 ${checked ? "bg-[#ff650f]" : "bg-[#343630]"}`}>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
        <span className={`absolute top-1 size-3 bg-[#0a0b09] transition ${checked ? "left-5" : "left-1"}`} />
      </span>
    </label>
  );
}
