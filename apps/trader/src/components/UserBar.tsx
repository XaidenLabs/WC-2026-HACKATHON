"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, UserRound, Wallet } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useTraderWallet } from "@/hooks/useTraderWallet";
import { useUserPreferences } from "@/hooks/useUserPreferences";

function cn(...i: ClassValue[]) {
  return twMerge(clsx(i));
}
export default function UserBar({ compact = false, variant = "default" }: { compact?: boolean; variant?: "default" | "terminal" }) {
  const router = useRouter();
  const { ready, authenticated, login, logout, wallet, email, userId } = useTraderWallet();
  const { preferences } = useUserPreferences(userId);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!ready) return <div className={variant === "terminal" ? "h-10 w-24 animate-pulse bg-[#171816]" : "h-9 w-24 animate-pulse rounded-full bg-black/10"} />;
  if (!authenticated) {
    return (
      <button onClick={login} className={variant === "terminal"
        ? "h-10 border border-[#30322c] bg-[#171816] px-3 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[#d0d1cc] transition hover:border-[#ff650f] hover:text-[#ff7a2f]"
        : compact
        ? "rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10"
        : "rounded-full bg-[#21172f] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#3a2b4f]"}>
        Sign in
      </button>
    );
  }

  const bal = wallet?.balance;
  const pnl = wallet?.netPnl ?? 0;
  const displayName = preferences.displayName || email?.split("@")[0] || "Trader";

  async function signOut() {
    setOpen(false);
    await logout();
    router.push("/");
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Open account menu"
        className={cn("flex items-center gap-2 border px-3 py-2 font-mono text-xs transition",
          variant === "terminal" ? "h-10 border-[#30322c] bg-[#171816] text-[#d5d6d1] hover:border-[#ff650f]" : compact ? "rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15" : "rounded-full border-[#d9d0e7] bg-white text-[#21172f] hover:border-[#a98cf8]")}
      >
        <Wallet className={cn("size-3.5", variant === "terminal" ? "text-[#ff650f]" : compact ? "text-[#cbbcff]" : "text-[#8059e8]")} />
        <span className="font-bold">{bal != null ? bal.toFixed(2) : "…"} <span className={cn("hidden font-normal sm:inline", compact ? "text-white/50" : "text-[#8a8295]")}>{variant === "terminal" ? "credits" : "practice credits"}</span></span>
        {wallet && wallet.settled > 0 && (
          <span className={pnl >= 0 ? "hidden text-emerald-400 sm:inline" : "hidden text-red-400 sm:inline"}>{pnl >= 0 ? "+" : ""}{pnl}</span>
        )}
      </button>

      {open && (
        <div className={cn("absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 border p-2 shadow-2xl",
          variant === "terminal" || compact ? "border-[#30322c] bg-[#11120f] text-[#efefeb] shadow-black/40" : "border-[#ded6e8] bg-white text-[#21172f] shadow-black/10")}
        >
          <div className={cn("border-b px-3 py-3", variant === "terminal" || compact ? "border-[#252721]" : "border-[#eee8f3]")}>
            <div className="flex items-center gap-3">
              <span className={cn("grid size-9 place-items-center", variant === "terminal" || compact ? "bg-[#25170e] text-[#ff650f]" : "bg-[#eee8ff] text-[#8059e8]")}>
                <UserRound className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{displayName}</p>
                <p className={cn("mt-0.5 truncate text-[11px]", variant === "terminal" || compact ? "text-[#777972]" : "text-[#756d82]")}>{email ?? "Signed in"}</p>
              </div>
            </div>
          </div>

          <MenuLink href="/settings" icon={Settings} label="Profile settings" terminal={variant === "terminal" || compact} onClick={() => setOpen(false)} />
          <MenuLink href="/wallet" icon={Wallet} label="Funds and balance" terminal={variant === "terminal" || compact} onClick={() => setOpen(false)} />
          <button
            type="button"
            onClick={signOut}
            className={cn("mt-1 flex w-full items-center gap-3 px-3 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition",
              variant === "terminal" || compact ? "text-[#ff8a49] hover:bg-[#1a130d]" : "text-[#b84e1e] hover:bg-[#fff2e8]")}
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon: Icon, label, terminal, onClick }: { href: string; icon: typeof Settings; label: string; terminal: boolean; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn("mt-1 flex items-center gap-3 px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition",
        terminal ? "text-[#d0d1cc] hover:bg-[#171816] hover:text-[#ff7a2f]" : "text-[#50465f] hover:bg-[#f6f3fb] hover:text-[#21172f]")}
    >
      <Icon className="size-4" /> {label}
    </Link>
  );
}
