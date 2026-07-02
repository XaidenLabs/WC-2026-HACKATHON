"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Loader2, Radio } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center bg-ink">
        <Loader2 className="size-6 animate-spin text-text-dim" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-5 bg-ink px-6 py-24 text-center">
        <div className="rounded-full border border-line bg-ink-2 p-5">
          <Radio className="size-10 text-signal" />
        </div>
        <div>
          <h1 className="font-mono text-3xl font-bold tracking-[0.18em] text-text">PULSE</h1>
          <p className="mt-3 text-sm leading-relaxed text-text-dim">
            Your AI football companion. Sign in to place bets, view live odds, and join the sweepstakes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => login()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-signal px-6 py-4 font-bold tracking-wide text-ink transition-all hover:bg-signal/90 active:scale-[0.98]"
        >
          Sign in
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
