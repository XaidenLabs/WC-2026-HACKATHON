"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio, Dices, Users, Zap } from "lucide-react";

const TABS = [
  { href: "/pulse", label: "Feed", Icon: Radio, exact: true },
  { href: "/pulse/hilo", label: "Hi-Lo", Icon: Dices },
  { href: "/pulse/sweepstake", label: "Sweeps", Icon: Users },
  { href: "/pulse/alerts", label: "Alerts", Icon: Zap },
];

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink/90 px-4 py-3 backdrop-blur">
        <Link href="/pulse" className="flex items-center gap-2">
          <span className="font-mono text-base font-bold tracking-[0.18em] text-text">
            PULSE
          </span>
          <span className="size-1.5 animate-livedot rounded-full bg-signal" aria-hidden />
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
          World Cup 2026
        </span>
      </header>

      {/* Content */}
      <main className="flex-1 pb-24">{children}</main>

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-ink/95 backdrop-blur">
        <div className="grid grid-cols-4">
          {TABS.map(({ href, label, Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? "text-signal" : "text-text-dim hover:text-text"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
