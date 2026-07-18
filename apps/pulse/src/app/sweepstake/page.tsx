"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Plus, LogIn, Loader2, ChevronRight, Trophy } from "lucide-react";
import { getMemberships, saveMembership, type Membership } from "@/lib/pulse/membership";

export default function SweepstakeIndex() {
  const router = useRouter();
  const [groups] = useState<Record<string, Membership>>(() => getMemberships());
  const entries = Object.entries(groups);

  // Create form
  const [groupName, setGroupName] = useState("");
  const [yourName, setYourName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join form
  const [joinCode, setJoinCode] = useState("");

  async function create() {
    if (!groupName.trim() || !yourName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const r = await fetch("/api/pulse/sweepstake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName, creatorName: yourName }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error ?? "Couldn't create group");
        return;
      }
      saveMembership(j.code, {
        memberId: j.member.id,
        name: j.member.name,
        team: j.member.team,
        groupName: groupName.trim(),
      });
      router.push(`/sweepstake/${j.code}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="px-4 py-5">
      <div className="mb-1 flex items-center gap-2">
        <Users className="size-5 text-signal" aria-hidden />
        <h1 className="text-lg font-semibold text-text">Sweepstakes</h1>
      </div>
      <p className="mb-5 text-sm text-text-dim">
        Make a group, share one link. Everyone gets a random World Cup team and the leaderboard
        updates live · no spreadsheet, no admin.
      </p>

      {/* Your groups */}
      {entries.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2.5 font-mono text-[11px] uppercase tracking-widest text-text-dim">
            Your groups
          </h2>
          <div className="flex flex-col gap-2">
            {entries.map(([code, m]) => (
              <Link
                key={code}
                href={`/sweepstake/${code}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 p-3.5 transition-colors hover:bg-ink-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{m.groupName}</p>
                  <p className="font-mono text-[10px] text-text-dim">
                    {code} · your team: <span className="text-signal">{m.team}</span>
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-text-dim" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Create */}
      <section className="mb-6 rounded-2xl border border-line bg-ink-2 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
          <Plus className="size-4 text-signal" aria-hidden /> Create a group
        </h2>
        <div className="flex flex-col gap-2.5">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (e.g. Office WC Sweep)"
            className="rounded-md border border-line bg-ink px-3 py-2.5 text-sm text-text placeholder:text-text-dim/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          />
          <input
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
            placeholder="Your name"
            className="rounded-md border border-line bg-ink px-3 py-2.5 text-sm text-text placeholder:text-text-dim/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          />
          {error && <p className="text-xs text-live">{error}</p>}
          <button
            type="button"
            onClick={create}
            disabled={creating || !groupName.trim() || !yourName.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-signal py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trophy className="size-4" aria-hidden />}
            Create & get my team
          </button>
        </div>
      </section>

      {/* Join */}
      <section className="rounded-2xl border border-line bg-ink-2 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
          <LogIn className="size-4 text-signal" aria-hidden /> Join with a code
        </h2>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="6-letter code"
            maxLength={6}
            className="flex-1 rounded-md border border-line bg-ink px-3 py-2.5 font-mono text-sm uppercase tracking-widest text-text placeholder:text-text-dim/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          />
          <button
            type="button"
            onClick={() => joinCode.trim() && router.push(`/sweepstake/${joinCode.trim()}`)}
            disabled={joinCode.trim().length < 6}
            className="shrink-0 rounded-md border border-line px-4 text-sm font-medium text-text transition-colors hover:bg-ink-3 disabled:opacity-40"
          >
            Go
          </button>
        </div>
      </section>
    </div>
  );
}
