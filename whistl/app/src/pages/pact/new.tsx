import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
// In a real app we'd import the Anchor helper here
// import { createPactTx } from "../../../utils/anchor";

export default function NewPact() {
  const router = useRouter();
  const { fixture } = router.query;
  const { connected } = useWallet();

  const [amount, setAmount] = useState("");
  const [prediction, setPrediction] = useState("home_win");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState("");

  const handleCreatePact = async () => {
    if (!connected) return alert("Connect your wallet first!");
    if (!amount || isNaN(Number(amount))) return alert("Enter a valid USDC amount");

    setIsSubmitting(true);
    try {
      // Mocking transaction delay
      await new Promise((res) => setTimeout(res, 2000));
      
      // Here we would call the Anchor create_pact instruction
      // const tx = await createPactTx(wallet, amount, prediction, fixture);
      
      setTxHash("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLyvK... (MOCK)");
    } catch (err) {
      console.error(err);
      alert("Transaction failed!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden p-6 md:p-12 z-10">
      <Head>
        <title>Create Pact | WHISTL</title>
      </Head>

      <div className="absolute top-[30%] right-[-10%] w-[30rem] h-[30rem] bg-pink-600/10 rounded-full blur-[150px] animate-pulse-slow pointer-events-none" />

      <header className="flex justify-between items-center mb-12 max-w-4xl w-full mx-auto">
        <Link href="/matches">
          <a className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Markets
          </a>
        </Link>
        <div className="scale-90 origin-right">
          <WalletMultiButton className="premium-button !bg-white/10 !h-auto !py-2" />
        </div>
      </header>

      <div className="max-w-xl w-full mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Create Pact</h1>
          <p className="text-gray-400 text-lg">Fixture: <span className="text-purple-400 font-mono">{fixture || "Unknown"}</span></p>
        </div>

        <div className="glass-panel p-8">
          {txHash ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/50">
                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Pact Created!</h2>
              <p className="text-gray-400 mb-6">Your USDC is safely locked in the smart contract escrow.</p>
              <div className="bg-black/50 p-4 rounded-xl border border-white/5 break-all text-xs text-green-300 font-mono mb-8">
                {txHash}
              </div>
              <Link href="/matches">
                <a className="premium-button-primary block w-full text-center">Return to Markets</a>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Prediction Type</label>
                <select 
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors appearance-none"
                  value={prediction}
                  onChange={(e) => setPrediction(e.target.value)}
                >
                  <option value="home_win">Home Team Wins</option>
                  <option value="away_win">Away Team Wins</option>
                  <option value="draw">Match Ends in a Draw</option>
                  <option value="over_2_5">Total Goals &gt; 2.5</option>
                  <option value="yellow_cards_5">Total Yellow Cards &gt; 5.5</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Wager Amount (USDC)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    placeholder="100" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-4 pr-16 py-3 text-white text-lg font-mono focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">
                    USDC
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 mt-6">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Platform Fee (0.5%)</span>
                  <span>{amount ? (Number(amount) * 0.005).toFixed(2) : "0.00"} USDC</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-white mb-8">
                  <span>Total Lock</span>
                  <span>{amount ? (Number(amount) * 1.005).toFixed(2) : "0.00"} USDC</span>
                </div>

                <button 
                  onClick={handleCreatePact}
                  disabled={isSubmitting || !connected}
                  className={`w-full premium-button-primary !py-4 flex justify-center items-center ${(!connected || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : connected ? (
                    "Sign & Lock Funds"
                  ) : (
                    "Wallet Disconnected"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
