import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";

// Mock data representing the 104 World Cup fixtures from TxODDS
const mockFixtures = [
  { id: "WC-2026-001", home: "USA", away: "England", time: "2026-06-11T16:00:00Z", status: "Upcoming", odds: { home: "+150", away: "-110", draw: "+210" } },
  { id: "WC-2026-002", home: "Mexico", away: "Germany", time: "2026-06-12T14:00:00Z", status: "Upcoming", odds: { home: "+300", away: "-200", draw: "+250" } },
  { id: "WC-2026-003", home: "Canada", away: "Brazil", time: "2026-06-12T18:00:00Z", status: "Upcoming", odds: { home: "+500", away: "-400", draw: "+350" } },
  { id: "WC-2026-004", home: "France", away: "Japan", time: "2026-06-13T16:00:00Z", status: "Live", odds: { home: "-300", away: "+450", draw: "+280" }, score: "1 - 0" },
];

export default function Matches() {
  const [fixtures, setFixtures] = useState(mockFixtures);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden p-6 md:p-12 z-10">
      <Head>
        <title>Markets | WHISTL</title>
      </Head>

      <div className="absolute top-[20%] left-[50%] w-[40rem] h-[40rem] bg-purple-600/10 rounded-full blur-[150px] animate-pulse-slow pointer-events-none transform -translate-x-1/2" />

      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Live Markets</h1>
          <p className="text-gray-400">Select a TxODDS verified fixture to create a trustless pact.</p>
        </div>
        <Link href="/">
          <a className="premium-button !py-2 !px-6 bg-white/5 hover:bg-white/10 text-sm">Back Home</a>
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl w-full mx-auto">
        {fixtures.map((match) => (
          <div key={match.id} className="glass-panel p-6 group hover:border-purple-500/50 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${match.status === "Live" ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse" : "bg-blue-500/20 text-blue-400 border border-blue-500/30"}`}>
                {match.status}
              </span>
            </div>

            <div className="text-sm text-gray-500 mb-4">{new Date(match.time).toLocaleString()} • {match.id}</div>
            
            <div className="flex justify-between items-center mb-6">
              <div className="text-2xl font-bold text-white text-center w-2/5">{match.home}</div>
              <div className="text-lg font-black text-gray-600 w-1/5 text-center">
                {match.score ? <span className="text-white text-2xl">{match.score}</span> : "vs"}
              </div>
              <div className="text-2xl font-bold text-white text-center w-2/5">{match.away}</div>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-black/40 rounded-lg p-3 text-center border border-white/5 group-hover:border-purple-500/20 transition-colors">
                <div className="text-xs text-gray-500 mb-1">Home</div>
                <div className="text-lg font-medium text-white">{match.odds.home}</div>
              </div>
              <div className="flex-1 bg-black/40 rounded-lg p-3 text-center border border-white/5 group-hover:border-purple-500/20 transition-colors">
                <div className="text-xs text-gray-500 mb-1">Draw</div>
                <div className="text-lg font-medium text-white">{match.odds.draw}</div>
              </div>
              <div className="flex-1 bg-black/40 rounded-lg p-3 text-center border border-white/5 group-hover:border-purple-500/20 transition-colors">
                <div className="text-xs text-gray-500 mb-1">Away</div>
                <div className="text-lg font-medium text-white">{match.odds.away}</div>
              </div>
            </div>

            <Link href={`/pact/new?fixture=${match.id}`}>
              <a className="block w-full text-center premium-button-primary !py-3 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                Create Pact
              </a>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
