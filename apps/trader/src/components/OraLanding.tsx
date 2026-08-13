import {
  BellRing,
  Brain,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Goal,
  LineChart,
  MessageSquareText,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import Header from "@/components/Header";
import LandingAppButton from "@/components/LandingAppButton";
import { HeroEntrance, ProductPreviewEntrance, ProofNarrative } from "@/components/LandingMotion";
import OraPicks from "@/components/OraPicks";

const CONTACT_EMAIL = "alfred@tryora.fun";

const MARKET_ANGLES = [
  "Match winner",
  "Over 1.5 goals",
  "Under 2.5 goals",
  "Under 3.5 goals",
  "Both teams to score",
  "Forecast only",
  "Trade qualified",
] as const;

const FLOW = [
  {
    icon: CalendarDays,
    title: "Start from the match calendar",
    body: "TXAgent shows live and upcoming football games in the same place, so users begin with what they already understand.",
  },
  {
    icon: Brain,
    title: "ORA scans the angles",
    body: "The engine compares forecasts, prices, goal lines, BTTS, and match winner markets before it marks anything useful.",
  },
  {
    icon: BellRing,
    title: "Users stay in the loop",
    body: "When ORA finds a possible pick, the user can approve, decline, change the amount, pause, or let auto-pick follow saved limits.",
  },
  {
    icon: ShieldCheck,
    title: "The result is saved",
    body: "Every pick, pass, result, and balance update becomes part of the user history, with technical proof kept out of the way.",
  },
] as const;

const GRANT_POINTS = [
  "Agent that watches a live football market",
  "Human supervision before automated action",
  "Provider-flexible data layer with TXLine first",
  "Football-first UX for normal sports users",
] as const;

export default function OraLanding() {
  return (
    <main className="landing-page landing-terminal relative w-full max-w-full overflow-x-hidden bg-[#0a0b09] text-[#efefeb]">
      <div className="landing-terminal-grain pointer-events-none fixed inset-0 z-40" aria-hidden="true" />
      <Header variant="public" />

      <section className="relative overflow-hidden px-4 pb-14 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-[calc(100dvh-88px)] max-w-7xl items-center gap-10 lg:grid-cols-[0.86fr_1.14fr]">
          <HeroEntrance>
            <div className="max-w-2xl">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#ff650f]">
                TXAgent powered by ORA
              </p>
              <h1 className="mt-5 max-w-3xl text-balance text-[clamp(3.2rem,6.4vw,6.75rem)] font-black leading-[0.88] tracking-[-0.06em] text-[#f4f4ef]">
                Football markets, filtered.
              </h1>
              <p className="mt-6 max-w-[50ch] text-base leading-7 text-[#999b93] sm:text-lg">
                ORA scans games, explains likely outcomes, and highlights prices worth reviewing.
              </p>
              <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
                <LandingAppButton
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[5px] bg-[#ff650f] px-6 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#0a0b09] transition hover:bg-[#ff7a2f] active:translate-y-px"
                />
                <a
                  href="#how-ora-works"
                  className="inline-flex min-h-12 items-center justify-center rounded-[5px] border border-[#30322c] bg-[#151613] px-6 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#d4d5cf] transition hover:border-[#ff650f] hover:text-[#ff7a2f] active:translate-y-px"
                >
                  See how it works
                </a>
              </div>
            </div>
          </HeroEntrance>

          <ProductPreviewEntrance>
            <div className="relative">
              <div className="absolute -inset-4 -z-10 bg-[#ff650f]/10 blur-3xl" aria-hidden="true" />
              <div className="border border-[#2f312b] bg-[#10110f] p-2 shadow-[0_35px_120px_rgba(0,0,0,0.42)]">
                <div className="flex items-center justify-between border-b border-[#252721] px-4 py-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#666861]">Live product view</p>
                    <p className="mt-1 text-sm font-black text-[#efefeb]">Market calendar</p>
                  </div>
                  <span className="border border-[#1f4a35] bg-[#0d1711] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#4ee58a]">
                    Football data live
                  </span>
                </div>
                <div className="max-h-[620px] overflow-hidden bg-[#0a0b09] p-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2 border border-[#30322c] bg-[#11120f] p-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#ff7a2f]">If I stake</span>
                    {[25, 50, 100].map((stake) => (
                      <span key={stake} className={stake === 50 ? "border border-[#ff650f] bg-[#25170e] px-2.5 py-1 font-mono text-xs font-bold text-[#ff7a2f]" : "border border-[#30322c] px-2.5 py-1 font-mono text-xs font-bold text-[#777972]"}>
                        {stake}
                      </span>
                    ))}
                    <span className="ml-auto text-[11px] text-[#686a64]">ORA prices every match.</span>
                  </div>
                  <OraPicks limit={4} stake={50} />
                </div>
              </div>
            </div>
          </ProductPreviewEntrance>
        </div>
      </section>

      <section id="product" className="border-y border-[#252721] bg-[#0d0e0c] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          <Stat label="Core idea" value="Scan" detail="ORA watches the market before the user has to." />
          <Stat label="Main user" value="Sports fan" detail="Simple words, clear picks, no technical noise." />
          <Stat label="Current focus" value="Football" detail="MLS now, Premier League when TXLine enables it." />
        </div>
      </section>

      <section id="how-ora-works" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="max-w-3xl">
          <h2 className="text-balance text-4xl font-black leading-[0.98] tracking-[-0.045em] text-[#f4f4ef] sm:text-6xl">
            What ORA actually does.
          </h2>
          <p className="mt-5 max-w-[58ch] text-base leading-7 text-[#8c8e87]">
            ORA is not a tips page. It is the engine inside TXAgent that watches games, compares market angles, and tells the user what deserves attention.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FLOW.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="min-h-64 border border-[#252721] bg-[#11120f] p-6 transition hover:border-[#ff650f]/60 hover:bg-[#151613]">
                <Icon className="size-6 text-[#ff650f]" strokeWidth={1.8} />
                <h3 className="mt-8 text-xl font-black tracking-[-0.03em] text-[#efefeb]">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#7d7f78]">{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="markets" className="border-y border-[#252721] bg-[#0d0e0c] px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <h2 className="max-w-lg text-4xl font-black leading-[1] tracking-[-0.045em] text-[#f4f4ef] sm:text-6xl">
              More than home, draw, away.
            </h2>
            <p className="mt-5 max-w-[52ch] text-base leading-7 text-[#8c8e87]">
              Every game can have a forecast. A trade only appears when the price clears ORA&apos;s value and risk rules.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {MARKET_ANGLES.map((angle, index) => (
              <div key={angle} className={`border p-5 ${index === 0 || index === 4 ? "border-[#4b2b17] bg-[#1a120d]" : "border-[#252721] bg-[#11120f]"}`}>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#676963]">Market angle</p>
                <p className="mt-3 text-lg font-black text-[#efefeb]">{angle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="today" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-[0.62fr_1.38fr]">
          <div>
            <LineChart className="size-7 text-[#ff650f]" />
            <h2 className="mt-6 text-4xl font-black leading-[1] tracking-[-0.045em] text-[#f4f4ef] sm:text-5xl">
              The first screen is the product.
            </h2>
            <p className="mt-5 max-w-[48ch] text-base leading-7 text-[#8c8e87]">
              Users land on football games, not a wall of technical claims. ORA&apos;s scan is the entry point.
            </p>
          </div>
          <div className="border border-[#252721] bg-[#10110f] p-3 sm:p-5">
            <OraPicks limit={6} stake={50} />
          </div>
        </div>
      </section>

      <section id="data" className="border-y border-[#252721] bg-[#0d0e0c] px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="max-w-3xl text-4xl font-black leading-[1] tracking-[-0.045em] text-[#f4f4ef] sm:text-6xl">
              Built for live data, not hardcoded demos.
            </h2>
            <p className="mt-5 max-w-[58ch] text-base leading-7 text-[#8c8e87]">
              TXAgent can run TXLine first, Sportmonks as enrichment, or both through a provider switch. The product stays ready as coverage grows.
            </p>
          </div>
          <div className="grid gap-3">
            <Signal title="TXLine first" body="Fixtures, odds, scores, and proof-ready settlement paths." icon={ShieldCheck} />
            <Signal title="Sportmonks fallback" body="Extra football context where the league coverage helps ORA explain better." icon={Goal} />
            <Signal title="User language" body="Technical records are available, but the main product speaks football." icon={MessageSquareText} />
          </div>
        </div>
      </section>

      <ProofNarrative />

      <section id="grant" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Trophy className="size-7 text-[#ff650f]" />
            <h2 className="mt-6 max-w-xl text-4xl font-black leading-[1] tracking-[-0.045em] text-[#f4f4ef] sm:text-6xl">
              Grant-ready agent work.
            </h2>
            <p className="mt-5 max-w-[54ch] text-base leading-7 text-[#8c8e87]">
              The story is simple: an agent that studies football markets, explains its thinking, and lets users supervise action.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {GRANT_POINTS.map((item) => (
              <div key={item} className="min-h-36 border border-[#252721] bg-[#11120f] p-5">
                <CheckCircle2 className="size-5 text-[#4ee58a]" />
                <p className="mt-5 text-base font-bold leading-6 text-[#efefeb]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 border border-[#4b2b17] bg-[#17110d] p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <CircleDollarSign className="size-7 text-[#ff650f]" />
            <h2 className="mt-6 max-w-3xl text-4xl font-black leading-[1] tracking-[-0.045em] text-[#f4f4ef] sm:text-6xl">
              Let ORA watch the next game.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#999b93]">
              Open the app, start with practice credits, and test the scan flow before real money enters the picture.
            </p>
          </div>
          <LandingAppButton className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[5px] bg-[#ff650f] px-6 font-mono text-[11px] font-black uppercase tracking-[0.08em] text-[#0a0b09] transition hover:bg-[#ff7a2f] active:translate-y-px" />
        </div>
      </section>

      <footer id="contact" className="border-t border-[#252721] px-4 py-8 text-sm text-[#777972] sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="font-black text-[#efefeb]">TXAgent</p>
            <p className="mt-1">Powered by ORA. Built for football users first.</p>
          </div>
          <div className="flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.1em]">
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#ff7a2f] hover:text-[#ff9555]">Contact</a>
            <LandingAppButton className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#d2d3ce] hover:text-[#ff7a2f]" showArrow={false} />
            <a href="#how-ora-works" className="text-[#d2d3ce] hover:text-[#ff7a2f]">How ORA works</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border border-[#252721] bg-[#11120f] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#676963]">{label}</p>
      <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#ff650f]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-[#8c8e87]">{detail}</p>
    </div>
  );
}

function Signal({ title, body, icon: Icon }: { title: string; body: string; icon: typeof ShieldCheck }) {
  return (
    <article className="grid grid-cols-[auto_1fr] gap-4 border border-[#252721] bg-[#11120f] p-5">
      <Icon className="size-5 text-[#ff650f]" strokeWidth={1.8} />
      <div>
        <h3 className="text-base font-black text-[#efefeb]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#8c8e87]">{body}</p>
      </div>
    </article>
  );
}
