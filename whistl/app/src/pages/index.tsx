import Head from "next/head";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Home() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <Head>
        <title>WHISTL Protocol | Trustless Prediction Markets</title>
        <meta
          name="description"
          content="Trustless P2P World Cup prop-bet escrow and settlement on Solana, powered by TxODDS."
        />
      </Head>

      {/* Decorative background blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/30 rounded-full blur-[120px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] bg-pink-600/20 rounded-full blur-[150px] animate-pulse-slow pointer-events-none" />

      {/* Header */}
      <header className="glass-panel mx-6 mt-6 px-8 py-4 flex justify-between items-center z-10 sticky top-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)]">
            <span className="font-bold text-white tracking-tighter">W</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">WHISTL</h1>
        </div>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-8 text-sm font-medium text-gray-300">
            <Link href="#markets"><a className="hover:text-white transition-colors">Markets</a></Link>
            <Link href="#agent"><a className="hover:text-white transition-colors">OOBE Agent</a></Link>
            <Link href="#proofs"><a className="hover:text-white transition-colors">Verifiable Proofs</a></Link>
          </nav>
          <div className="scale-90 origin-right">
            <WalletMultiButton className="premium-button !bg-white/10 !h-auto !py-3" />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 z-10 text-center mt-20 md:mt-0">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-purple-300 mb-8 animate-float">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Powered by TxODDS TxLINE & OOBE Protocol
        </div>
        
        <h2 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-tight max-w-5xl">
          Zero-Trust <br className="hidden md:block" />
          <span className="premium-gradient-text">Prediction Markets</span>
        </h2>
        
        <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mb-12 font-light">
          Create, trade, and settle custom P2P sports wagers instantly on Solana. 
          No centralized oracles. No custodians. Only cryptographic truth.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link href="/matches">
            <a className="premium-button-primary text-lg flex items-center justify-center">
              {connected ? "Launch Trading App" : "Connect Wallet"}
            </a>
          </Link>
          <Link href="/matches">
            <a className="premium-button text-lg flex items-center justify-center gap-2">
              Explore Open Pacts
              <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </a>
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 max-w-6xl w-full px-6 pb-20">
          <div className="glass-panel p-8 text-left group hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6 border border-purple-500/30 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Trustless Settlement</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Every bet is settled on-chain via TxLINE Merkle Proofs. We cryptographically prove the score statistics—meaning the protocol is 100% permissionless.
            </p>
          </div>

          <div className="glass-panel p-8 text-left group hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-6 border border-pink-500/30 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Autonomous OOBE Agent</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Our LangGraph agent runs 24/7 on Synapse. It watches live streams from TxODDS and automatically cranks the payout instruction the second a match concludes.
            </p>
          </div>

          <div className="glass-panel p-8 text-left group hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6 border border-blue-500/30 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Infinite Prop Bets</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Create multi-leg conditions using binary expressions. Bet on Corners + Goals &gt; 5, or Yellow Cards == 3. The possibilities are mathematically boundless.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
