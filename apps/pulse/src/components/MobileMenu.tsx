"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-text-dim transition-colors hover:bg-ink-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        aria-label="Open menu"
      >
        <Menu className="size-6" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed top-0 right-0 z-50 flex h-full w-72 flex-col bg-ink-2 border-l border-line shadow-2xl shadow-black/40 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <span className="font-mono text-sm font-semibold tracking-[0.2em] text-text">
            PULSE<span className="text-signal" aria-hidden>●</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-text-dim transition-colors hover:bg-ink-3 hover:text-text"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-3 text-base font-medium text-text-dim transition-colors hover:bg-ink-3 hover:text-text"
          >
            Live feed
          </Link>
          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-3 text-base font-medium text-text-dim transition-colors hover:bg-ink-3 hover:text-text"
          >
            Alerts
          </Link>
          <Link
            href="/hilo"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-3 text-base font-medium text-text-dim transition-colors hover:bg-ink-3 hover:text-text"
          >
            Hi-Lo
          </Link>
          <Link
            href="/sweepstake"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-3 text-base font-medium text-text-dim transition-colors hover:bg-ink-3 hover:text-text"
          >
            Friends
          </Link>
          <Link
            href="/mind"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-3 text-base font-medium text-signal transition-colors hover:bg-ink-3 hover:text-text"
          >
            ORA Mind
          </Link>
        </nav>

        <div className="border-t border-line px-5 py-4">
          <p className="font-mono text-[10px] text-text-dim uppercase tracking-wider">
            World Cup 2026 · Live fan intelligence
          </p>
        </div>
      </div>
    </>
  );
}
