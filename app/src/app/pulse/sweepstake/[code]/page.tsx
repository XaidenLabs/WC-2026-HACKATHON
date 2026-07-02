"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Trophy, Activity, LogIn, Copy } from "lucide-react";
import { getMembership, saveMembership, type Membership } from "@/lib/pulse/membership";
import type { LeaderRow } from "@/app/api/pulse/sweepstake/[code]/route";

type SweepstakeData = {
  sweepstake: { code: string; name: string };
  memberCount: number;
  leaderboard: LeaderRow[];
};

export default function SweepstakeDetail() {
  const params = useParams();
  const code = String(params.code).toUpperCase();
  const router = useRouter();

  const [data, setData] = useState<SweepstakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [membership, setMembership] = useState<Membership | null>(null);

  // Join form state
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMembership(getMembership(code));
    fetchData();
    // Auto-refresh leaderboard every 30s
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [code]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/pulse/sweepstake/${code}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Failed to load sweepstake");
      } else {
        setData(json);
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function join() {
    if (!joinName.trim() || !data) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/pulse/sweepstake/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName }),
      });
      const json = await res.json();
      if (!json.ok) {
        setJoinError(json.error ?? "Failed to join");
        return;
      }
      const newMembership = {
        memberId: json.member.id,
        name: json.member.name,
        team: json.member.team,
        groupName: data.sweepstake.name,
      };
      saveMembership(code, newMembership);
      setMembership(newMembership);
      await fetchData(); // Refresh leaderboard
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-signal" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 py-5 text-center">
        <p className="text-sm text-live">{error}</p>
        <Link href="/pulse/sweepstake" className="mt-4 inline-flex items-center gap-2 text-sm text-text-dim hover:text-text">
          <ArrowLeft className="size-4" /> Back to Groups
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 pb-20">
      <div className="mb-6">
        <Link href="/pulse/sweepstake" className="mb-4 inline-flex items-center gap-1.5 text-xs text-text-dim transition-colors hover:text-text">
          <ArrowLeft className="size-3" /> Back
        </Link>
        <h1 className="text-xl font-bold text-text">{data.sweepstake.name}</h1>
        <div className="mt-2 flex items-center justify-between">
          <p className="font-mono text-xs tracking-wider text-text-dim">CODE: {code}</p>
          <button 
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded bg-ink-2 px-2 py-1 text-xs text-text transition-colors hover:bg-ink-3"
          >
            {copied ? <span className="text-signal">Copied!</span> : <><Copy className="size-3" /> Copy Link</>}
          </button>
        </div>
      </div>

      {!membership && (
        <section className="mb-8 rounded-2xl border border-line bg-ink-2 p-5 shadow-lg">
          <h2 className="mb-2 text-base font-semibold text-text">Join this Sweepstake</h2>
          <p className="mb-4 text-sm text-text-dim">Enter your name to be assigned a random team from the tournament.</p>
          <div className="flex gap-2">
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Your name"
              className="flex-1 rounded-md border border-line bg-ink px-3 py-2.5 text-sm text-text placeholder:text-text-dim/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            />
            <button
              onClick={join}
              disabled={joining || !joinName.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-signal px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {joining ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              Join
            </button>
          </div>
          {joinError && <p className="mt-2 text-xs text-live">{joinError}</p>}
        </section>
      )}

      {membership && (
        <section className="mb-8 rounded-xl border border-signal/30 bg-signal/5 p-4 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 text-signal/10">
            <Trophy className="size-32" />
          </div>
          <div className="relative">
            <p className="mb-1 text-xs text-text-dim">Your Team</p>
            <div className="flex items-end gap-3">
              <span className="text-2xl font-bold text-signal">{membership.team}</span>
            </div>
            <p className="mt-2 text-sm text-text">Playing as <span className="font-medium">{membership.name}</span></p>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Live Leaderboard</h2>
          <span className="text-xs text-text-dim">{data.memberCount} players</span>
        </div>

        <div className="rounded-xl border border-line bg-ink overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-2 text-xs text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Rank</th>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium text-right">PTS</th>
                <th className="px-3 py-2 font-medium text-right">P</th>
                <th className="px-3 py-2 font-medium text-right">GF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-text-dim">
                    No players have joined yet.
                  </td>
                </tr>
              ) : (
                data.leaderboard.map((row, idx) => (
                  <tr 
                    key={row.name + row.team} 
                    className={`${membership?.team === row.team ? 'bg-signal/5' : ''} transition-colors hover:bg-ink-2`}
                  >
                    <td className="px-3 py-3 text-text-dim w-12 text-center">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-text">{row.name}</span>
                        {row.live && <Activity className="size-3 text-live animate-pulse" aria-label="Match live" />}
                      </div>
                      <div className="text-xs text-text-dim">{row.team}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-signal">{row.points}</td>
                    <td className="px-3 py-3 text-right text-text-dim">{row.played}</td>
                    <td className="px-3 py-3 text-right text-text-dim">{row.goalsFor}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
