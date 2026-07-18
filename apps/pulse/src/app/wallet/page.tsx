"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import useSWR from "swr";
import {
  ArrowLeft, Copy, Check, ExternalLink, RefreshCw,
  ArrowUpRight, ArrowDownLeft, Coins, Loader2, AlertCircle,
} from "lucide-react";
import { useBalance } from "@/hooks/useBalance";
import { useWhistlActions } from "@/lib/whistl/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const fmtUsdc = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EXPLORER = (addr: string) => `https://explorer.solana.com/address/${addr}?cluster=devnet`;
const TX_EXPLORER = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

const fetcher = async (url: string, token: string) => {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return r.json();
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function BalanceCard({ usdc, sol, loading, refresh, walletAddress }: {
  usdc: number | null; sol: number | null; loading: boolean;
  refresh: () => void; walletAddress: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-2xl border border-line bg-ink-2 overflow-hidden">
      {/* Big balance */}
      <div className="px-6 pt-6 pb-4 border-b border-line">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-dim mb-1">Available balance</p>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold tabular-nums text-signal">
                {usdc != null ? fmtUsdc(usdc) : "·"}
              </span>
              <span className="font-mono text-base text-text-dim">USDC</span>
            </div>
            {sol != null && (
              <p className="mt-1 font-mono text-xs text-text-dim">
                {sol.toFixed(4)} SOL for gas
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={refresh}
            className="rounded-md p-2 text-text-dim transition-colors hover:bg-ink-3 hover:text-text"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Wallet address */}
      <div className="flex items-center gap-3 px-6 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-widest text-text-dim mb-0.5">Your wallet</p>
          <p className="truncate font-mono text-xs text-text">{walletAddress}</p>
        </div>
        <button type="button" onClick={copy}
          className="shrink-0 rounded p-1.5 text-text-dim transition-colors hover:bg-ink-3 hover:text-text" title="Copy">
          {copied ? <Check className="size-3.5 text-signal" /> : <Copy className="size-3.5" />}
        </button>
        <a href={EXPLORER(walletAddress)} target="_blank" rel="noreferrer"
          className="shrink-0 rounded p-1.5 text-text-dim transition-colors hover:bg-ink-3 hover:text-text" title="View on explorer">
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function TopUpPanel({ onDone }: { onDone: () => void }) {
  const { wallet, faucet } = useWhistlActions();
  const { getAccessToken } = usePrivy();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function handleFaucet() {
    if (!wallet) return;
    setStatus("loading");
    const token = await getAccessToken();
    const r = await fetch("/api/faucet", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ wallet: wallet.address }),
    }).then((x) => x.json()).catch(() => ({ ok: false }));
    if (r.ok) {
      setStatus("done");
      setMsg(`+500 test-USDC added to your wallet`);
      setTimeout(onDone, 1500);
    } else {
      setStatus("error");
      setMsg(r.error ?? "Faucet failed");
    }
    void faucet; // keep the import used
  }

  return (
    <div className="rounded-xl border border-line bg-ink-2 p-5 space-y-4">
      <div>
        <p className="font-semibold text-text">Top up test-USDC</p>
        <p className="mt-1 text-sm text-text-dim">
          Get 500 test-USDC on Solana devnet · free, instantly minted to your wallet.
          Use it to place bets on World Cup matches.
        </p>
      </div>

      {status === "done" ? (
        <div className="flex items-center gap-2 rounded-lg bg-signal/10 px-4 py-3 text-sm text-signal">
          <Check className="size-4" />
          {msg}
        </div>
      ) : status === "error" ? (
        <div className="flex items-center gap-2 rounded-lg bg-live/10 px-4 py-3 text-sm text-live">
          <AlertCircle className="size-4" />
          {msg}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleFaucet}
          disabled={status === "loading"}
          className="inline-flex items-center gap-2 rounded-md bg-signal px-5 py-2.5 font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />}
          Get 500 test-USDC
        </button>
      )}

      <p className="font-mono text-[10px] text-text-dim">
        Devnet only · test tokens have no monetary value
      </p>
    </div>
  );
}

function WithdrawPanel({ available, fromAddress, onDone }: {
  available: number; fromAddress: string; onDone: () => void;
}) {
  const { transferUsdc } = useWhistlActions();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [sig, setSig] = useState("");
  const [err, setErr] = useState("");

  const parsedAmount = parseFloat(amount) || 0;
  const valid = to.length > 30 && parsedAmount > 0 && parsedAmount <= available && to !== fromAddress;

  async function handleSend() {
    if (!valid) return;
    setStatus("loading");
    try {
      const res = await transferUsdc({ toAddress: to, amount: parsedAmount, fromAddress });
      setSig(res.sig);
      setStatus("done");
      setTimeout(onDone, 3000);
    } catch (e) {
      setErr((e as Error).message ?? "Transfer failed");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-signal/30 bg-ink-2 p-5 space-y-3">
        <div className="flex items-center gap-2 text-signal">
          <Check className="size-5" />
          <p className="font-semibold">Transfer sent</p>
        </div>
        <p className="text-sm text-text-dim">
          {fmtUsdc(parsedAmount)} USDC → {short(to)}
        </p>
        <a
          href={TX_EXPLORER(sig)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-proof hover:underline"
        >
          View on Solana Explorer <ExternalLink className="size-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-ink-2 p-5 space-y-4">
      <div>
        <p className="font-semibold text-text">Withdraw USDC</p>
        <p className="mt-1 text-sm text-text-dim">
          Send test-USDC to any Solana wallet. Winnings are already in your wallet ·
          this moves them to another address you control.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-text-dim">
            Recipient wallet address
          </label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            placeholder="Paste Solana address…"
            className="w-full rounded-md border border-line bg-ink px-3 py-2.5 font-mono text-sm text-text placeholder:text-text-dim/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          />
        </div>

        <div>
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-text-dim">
            Amount (USDC)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0.01}
              step={0.01}
              max={available}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-md border border-line bg-ink px-3 py-2.5 font-mono text-sm text-text placeholder:text-text-dim/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            />
            <button
              type="button"
              onClick={() => setAmount(available.toFixed(2))}
              className="shrink-0 rounded-md border border-line px-3 py-2.5 font-mono text-xs text-text-dim transition-colors hover:border-signal/40 hover:text-text"
            >
              Max
            </button>
          </div>
          <p className="mt-1 font-mono text-[10px] text-text-dim">
            Available: {fmtUsdc(available)} USDC
          </p>
        </div>
      </div>

      {status === "error" && (
        <div className="flex items-center gap-2 rounded-lg bg-live/10 px-3 py-2 text-sm text-live">
          <AlertCircle className="size-4 shrink-0" />
          {err}
        </div>
      )}

      <button
        type="button"
        disabled={!valid || status === "loading"}
        onClick={handleSend}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-signal px-5 py-3 font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {status === "loading"
          ? <><Loader2 className="size-4 animate-spin" />Sending…</>
          : <><ArrowUpRight className="size-4" />Send {parsedAmount > 0 ? `${fmtUsdc(parsedAmount)} USDC` : "USDC"}</>
        }
      </button>
    </div>
  );
}

function RecentActivity({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { data } = useSWR(
    "/api/pacts/me",
    async (url: string) => {
      const token = await getAccessToken();
      if (!token) return null;
      return fetcher(url, token);
    },
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );

  const pacts: Array<{
    id: string;
    statement: string;
    stake_usdc: number;
    status: string;
    predicate_result?: boolean;
    final_value?: number;
    settle_tx_sig?: string;
  }> = data?.pacts ?? [];

  if (!pacts.length) return null;

  const statusLabel = (s: string, won?: boolean) => {
    if (s === "settled") return won ? "WON ✓" : "LOST ✗";
    if (s === "accepted") return "LIVE";
    if (s === "created") return "OPEN";
    return s.toUpperCase();
  };
  const statusColor = (s: string, won?: boolean) => {
    if (s === "settled") return won ? "text-signal" : "text-live";
    if (s === "accepted") return "text-live";
    return "text-text-dim";
  };

  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-dim">Recent bets</p>
      <div className="space-y-2">
        {pacts.slice(0, 8).map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-ink-2 px-4 py-3"
          >
            <div className={`shrink-0 rounded-full p-1.5 ${
              p.status === "settled" && p.predicate_result
                ? "bg-signal/10"
                : p.status === "settled"
                ? "bg-live/10"
                : "bg-ink-3"
            }`}>
              {p.status === "settled"
                ? p.predicate_result
                  ? <ArrowDownLeft className="size-3.5 text-signal" />
                  : <ArrowUpRight className="size-3.5 text-live" />
                : <ArrowUpRight className="size-3.5 text-text-dim" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text">{p.statement}</p>
              <p className="font-mono text-[10px] text-text-dim">
                {fmtUsdc(p.stake_usdc)} USDC staked
                {p.final_value != null && ` · value: ${p.final_value}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-mono text-xs font-semibold ${statusColor(p.status, p.predicate_result)}`}>
                {statusLabel(p.status, p.predicate_result)}
              </p>
              {p.settle_tx_sig && (
                <a
                  href={TX_EXPLORER(p.settle_tx_sig)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-mono text-[9px] text-proof hover:underline"
                >
                  proof <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { ready, getAccessToken } = usePrivy();
  const { usdc, sol, loading, refresh, walletAddress } = useBalance();
  const [tab, setTab] = useState<"topup" | "withdraw">("topup");

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-text-dim" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 sm:px-6 py-8 sm:py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" /> Live feed
      </Link>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-text">Your Wallet</h1>

      <div className="space-y-5">
        {/* Balance card */}
        {walletAddress && (
          <BalanceCard
            usdc={usdc}
            sol={sol}
            loading={loading}
            refresh={refresh}
            walletAddress={walletAddress}
          />
        )}

        {/* How winnings work */}
        <div className="rounded-xl border border-signal/20 bg-signal/5 px-5 py-4">
          <p className="text-sm font-medium text-signal mb-1">How winnings work</p>
          <p className="text-sm leading-relaxed text-text-dim">
            When you win a bet, the USDC lands directly in this wallet ·
            instantly, on-chain, no withdrawal needed. The balance above updates
            automatically within 15 seconds of settlement.
          </p>
        </div>

        {/* Top up / Withdraw tabs */}
        <div className="rounded-xl border border-line overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-line">
            {(["topup", "withdraw"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 py-3 font-mono text-sm transition-colors ${
                  tab === t
                    ? "bg-ink-2 text-signal border-b-2 border-signal"
                    : "bg-ink-3 text-text-dim hover:text-text"
                }`}
              >
                {t === "topup" ? (
                  <span className="flex items-center justify-center gap-2">
                    <ArrowDownLeft className="size-4" /> Top up
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <ArrowUpRight className="size-4" /> Withdraw
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === "topup" ? (
              <TopUpPanel onDone={refresh} />
            ) : (
              walletAddress && (
                <WithdrawPanel
                  available={usdc ?? 0}
                  fromAddress={walletAddress}
                  onDone={refresh}
                />
              )
            )}
          </div>
        </div>

        {/* Recent activity */}
        <RecentActivity getAccessToken={getAccessToken} />

        {/* Devnet note */}
        <p className="font-mono text-[10px] text-text-dim text-center">
          Solana devnet · test tokens only · program{" "}
          <a
            href={EXPLORER(process.env.NEXT_PUBLIC_WHISTL_PROGRAM_ID ?? "")}
            target="_blank"
            rel="noreferrer"
            className="text-proof hover:underline"
          >
            {short(process.env.NEXT_PUBLIC_WHISTL_PROGRAM_ID ?? "·")}
          </a>
        </p>
      </div>
    </div>
  );
}
