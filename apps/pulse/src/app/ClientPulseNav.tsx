"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio, Dices, Users, Zap, Brain } from "lucide-react";

const TABS = [
  { href: "/", label: "Feed", Icon: Radio, exact: true },
  { href: "/hilo", label: "Hi-Lo", Icon: Dices },
  { href: "/sweepstake", label: "Sweeps", Icon: Users },
  { href: "/alerts", label: "Alerts", Icon: Zap },
  { href: "/mind", label: "Mind", Icon: Brain },
];

export default function ClientPulseNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-ink/95 backdrop-blur">
      <div className="grid grid-cols-5">
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
  );
}
