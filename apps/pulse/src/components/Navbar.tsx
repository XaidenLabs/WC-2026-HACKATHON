"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "@/components/AuthButton";
import MobileMenu from "@/components/MobileMenu";

const links = [
  { href: "/matches", label: "Markets" },
  { href: "/wallet", label: "Wallet" },
  { href: "/bets", label: "My Bets" },
  { href: "/ora", label: "ORA Sentinel", accent: true },
];

export default function Navbar() {
  const pathname = usePathname();

  // WHISTL Pulse (the fan PWA) has its own mobile chrome — hide the Protocol navbar there.
  if (pathname === "/pulse" || pathname.startsWith("/pulse/")) return null;

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 sm:px-6 py-4">
        <Link
          href="/"
          className="font-mono text-lg font-semibold tracking-[0.2em] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal rounded-sm"
        >
          WHISTL<span className="text-signal" aria-hidden>●</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ href, label, accent }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                  active
                    ? "text-text bg-ink-2"
                    : accent
                    ? "text-signal hover:text-text"
                    : "text-text-dim hover:text-text"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <div className="ml-2">
            <AuthButton />
          </div>
        </nav>

        <div className="flex items-center gap-3 md:hidden">
          <AuthButton />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
