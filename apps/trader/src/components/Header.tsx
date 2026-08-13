"use client";

import Link from "next/link";
import { Activity, CalendarDays, ShieldCheck, Sparkles } from "lucide-react";
import LandingAppButton from "@/components/LandingAppButton";
import UserBar from "@/components/UserBar";
import { useTraderWallet } from "@/hooks/useTraderWallet";

type HeaderProps = {
  tagline?: string;
  variant?: "public" | "app";
};

/** TXAgent's shared navigation. The public version mirrors the reference pill. */
export default function Header({ tagline, variant = "app" }: HeaderProps) {
  const isPublic = variant === "public";
  const { ready, authenticated } = useTraderWallet();

  return (
    <header className={isPublic ? "relative z-30 border-b border-[#252721] bg-[#0a0b09]/95 px-4 py-2 backdrop-blur-sm sm:px-6" : "relative z-30 border-b border-[#ddd5e8] bg-white/75 px-4 py-3 backdrop-blur-xl sm:px-6"}>
      <div className={isPublic
        ? "mx-auto flex h-14 w-full max-w-7xl items-center justify-between text-[#efefeb]"
        : "mx-auto flex w-full max-w-7xl items-center justify-between"}>
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className={isPublic ? "grid size-9 place-items-center bg-[#ff650f] text-[#0a0b09]" : "grid size-9 place-items-center rounded-full bg-[#bda9ff] text-[#21172f]"}>
              <Sparkles className="size-4.5" strokeWidth={2.4} />
            </span>
            <span className="leading-none">
              <span className={isPublic ? "block text-base font-extrabold tracking-tight text-[#efefeb]" : "block text-base font-extrabold tracking-tight text-[#21172f]"}>TXAgent</span>
              <span className={isPublic ? "mt-1 block font-mono text-[8px] uppercase tracking-[0.16em] text-[#62645e]" : "mt-1 block text-[8px] uppercase tracking-[0.18em] text-[#756d82]"}>ORA intelligence</span>
            </span>
          </Link>

          {isPublic ? (
            <nav className="hidden items-center gap-5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#777972] md:flex">
              <a href="#product" className="transition-colors hover:text-[#ff7a2f]">Product</a>
              <a href="#how-ora-works" className="transition-colors hover:text-[#ff7a2f]">How ORA works</a>
              <a href="#markets" className="transition-colors hover:text-[#ff7a2f]">Markets</a>
              <a href="#data" className="transition-colors hover:text-[#ff7a2f]">Data</a>
              <a href="#contact" className="transition-colors hover:text-[#ff7a2f]">Contact</a>
            </nav>
          ) : (
            <nav className="hidden items-center gap-1 rounded-full border border-[#e2dbea] bg-white p-1 md:flex">
              <AppLink href="/dashboard" icon={CalendarDays}>Dashboard</AppLink>
              <AppLink href="/markets" icon={Activity}>Games</AppLink>
              <AppLink href="/ora" icon={Sparkles}>ORA</AppLink>
              <AppLink href="/portfolio" icon={ShieldCheck}>Record</AppLink>
            </nav>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {!isPublic && tagline && <span className="hidden text-[10px] text-[#8a8295] xl:inline">{tagline}</span>}
          {!isPublic && (
            <span className="hidden items-center gap-1.5 text-[10px] font-semibold text-[#19845c] lg:flex">
              <span className="size-1.5 rounded-full bg-[#23b477] shadow-[0_0_0_4px_rgba(35,180,119,0.12)]" />
              TXLINE LIVE
            </span>
          )}
          {isPublic && ready && authenticated && (
            <LandingAppButton className="hidden h-10 items-center gap-2 rounded-[5px] bg-[#ff650f] px-4 font-mono text-[9px] font-black uppercase tracking-[0.08em] text-[#0a0b09] transition hover:bg-[#ff7a2f] active:translate-y-px sm:inline-flex" />
          )}
          {isPublic && (!ready || !authenticated) && (
            <LandingAppButton signedOutLabel="Sign in" showArrow={false} className="inline-flex h-10 items-center justify-center rounded-[5px] bg-[#ff650f] px-4 font-mono text-[9px] font-black uppercase tracking-[0.08em] text-[#0a0b09] transition hover:bg-[#ff7a2f] active:translate-y-px" />
          )}
          {(!isPublic || authenticated) && <UserBar compact={isPublic} />}
        </div>
      </div>
    </header>
  );
}

function AppLink({ href, icon: Icon, children }: { href: string; icon: typeof Activity; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[#756d82] transition hover:bg-[#f0ebfa] hover:text-[#21172f]">
      <Icon className="size-3.5" /> {children}
    </Link>
  );
}
