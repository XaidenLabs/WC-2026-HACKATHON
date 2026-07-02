"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import useSWR from "swr";
import Image from "next/image";
import { ChevronDown, LogOut, Wallet, Copy, Check, LayoutList, TrendingUp } from "lucide-react";
import { useBalance } from "@/hooks/useBalance";

const btn =
  "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

const MEMO_AVATAR_COUNT = 35;
const memoAvatarUrl = (n: number) =>
  `https://cdn.jsdelivr.net/gh/alohe/avatars/png/memo_${n}.png`;

/** Simple deterministic hash so each user always gets the same avatar. */
function userToAvatarIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % MEMO_AVATAR_COUNT) + 1;
}

const short = (s: string) => (s.length > 10 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s);

function Inner() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const synced = useRef(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Background-fetch bet count for the "My Bets" badge — only when authenticated.
  const { data: betsData } = useSWR(
    authenticated ? "/api/pacts/me" : null,
    async (url: string) => {
      const token = await getAccessToken();
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      return r.json() as Promise<{ ok: boolean; pacts: Array<{ status: string }> }>;
    },
    { refreshInterval: 60_000, revalidateOnFocus: false },
  );
  const activeBetCount = useMemo(() => {
    if (!betsData?.pacts) return 0;
    return betsData.pacts.filter((p) => p.status === "created" || p.status === "accepted").length;
  }, [betsData]);

  // On login, sync the verified user into Supabase (token verified server-side).
  useEffect(() => {
    if (!authenticated || synced.current) return;
    synced.current = true;
    (async () => {
      try {
        const token = await getAccessToken();
        await fetch("/api/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            wallet: user?.wallet?.address ?? null,
            email: user?.email?.address ?? null,
          }),
        });
      } catch {
        synced.current = false; // allow a retry on next render
      }
    })();
  }, [authenticated, getAccessToken, user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Pick a deterministic avatar based on the user ID
  const avatarSrc = useMemo(() => {
    if (!user) return memoAvatarUrl(1);
    const idx = userToAvatarIndex(user.id);
    return memoAvatarUrl(idx);
  }, [user]);

  const walletAddress = user?.wallet?.address;
  const { usdc, loading: balLoading, refresh: refreshBalance } = useBalance();

  async function handleCopy() {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!ready) return <span className={`${btn} bg-ink-2 text-text-dim`}>…</span>;

  if (authenticated) {
    return (
      <div ref={dropdownRef} className="relative">
        {/* Avatar trigger — shows live USDC balance */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-2 p-1 pr-3 transition-colors hover:border-signal/40 hover:bg-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          aria-expanded={open}
          aria-haspopup="true"
        >
          <Image
            src={avatarSrc}
            alt="User avatar"
            width={32}
            height={32}
            className="rounded-full"
          />
          {/* Balance chip */}
          {usdc != null && (
            <span className="font-mono text-xs font-semibold text-signal tabular-nums">
              {balLoading ? "…" : `${usdc.toFixed(2)}`}
              <span className="ml-0.5 text-[9px] font-normal text-text-dim">USDC</span>
            </span>
          )}
          <ChevronDown
            className={`size-4 text-text-dim transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 z-50 mt-2 w-64 origin-top-right animate-rise rounded-xl border border-line bg-ink-2 shadow-xl shadow-black/30">
            {/* Header: avatar + identifier */}
            <div className="flex items-center gap-3 border-b border-line px-4 py-4">
              <Image
                src={avatarSrc}
                alt="User avatar"
                width={40}
                height={40}
                className="rounded-full"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">
                  {user?.email?.address ?? (walletAddress ? short(walletAddress) : "Account")}
                </p>
                {user?.email?.address && walletAddress && (
                  <p className="truncate font-mono text-xs text-text-dim">{short(walletAddress)}</p>
                )}
              </div>
            </div>

            {/* Wallet address row */}
            {walletAddress && (
              <div className="border-b border-line px-4 py-3">
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-text-dim">
                  Wallet
                </p>
                <div className="flex items-center gap-2">
                  <Wallet className="size-3.5 shrink-0 text-text-dim" aria-hidden />
                  <span className="flex-1 truncate font-mono text-xs text-text">
                    {walletAddress}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="rounded p-1 text-text-dim transition-colors hover:bg-ink-3 hover:text-text"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="size-3.5 text-signal" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Balance panel */}
            <div className="border-b border-line px-4 py-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-text-dim">Balance</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-mono text-xl font-bold tabular-nums text-signal">
                    {usdc != null ? usdc.toFixed(2) : "—"}
                    <span className="ml-1 text-xs font-normal text-text-dim">USDC</span>
                  </p>
                  {/* SOL shown smaller for gas awareness */}
                </div>
                <button
                  type="button"
                  onClick={() => { refreshBalance(); }}
                  className="rounded p-1 text-text-dim transition-colors hover:bg-ink-3 hover:text-text"
                  title="Refresh balance"
                >
                  <svg className={`size-3.5 ${balLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Navigation links */}
            <div className="border-b border-line p-2">
              <Link
                href="/wallet"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-dim transition-colors hover:bg-ink-3 hover:text-text"
              >
                <TrendingUp className="size-4" aria-hidden />
                Wallet
              </Link>
              <Link
                href="/bets"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-text-dim transition-colors hover:bg-ink-3 hover:text-text"
              >
                <span className="flex items-center gap-3">
                  <LayoutList className="size-4" aria-hidden />
                  My Bets
                </span>
                {activeBetCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-signal px-1.5 font-mono text-[10px] font-semibold text-ink">
                    {activeBetCount}
                  </span>
                )}
              </Link>
            </div>

            {/* Sign out */}
            <div className="p-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-dim transition-colors hover:bg-ink-3 hover:text-text"
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button type="button" onClick={() => login()} className={`${btn} bg-signal text-ink hover:opacity-90`}>
      Sign in
    </button>
  );
}

export default function AuthButton() {
  // Gracefully no-op until Privy is configured (keeps the landing rendering during setup).
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return (
      <span className={`${btn} border border-line text-text-dim`} title="Set NEXT_PUBLIC_PRIVY_APP_ID to enable login">
        Sign in
      </span>
    );
  }
  return <Inner />;
}
