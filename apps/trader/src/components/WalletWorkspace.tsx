"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CircleDollarSign,
  Copy,
  Fuel,
  History,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { useCreateWallet, useWallets } from "@privy-io/react-auth/solana";
import { useTraderWallet } from "@/hooks/useTraderWallet";
import {
  createWalletReview,
  DAILY_FAUCET_LIMIT,
  shortAddress,
  type WalletReview,
} from "@/lib/wallet/domain";
import { useMandateActions } from "@/lib/wallet/mandate-client";

type OnchainWallet = {
  address: string;
  cluster: "devnet";
  solBalance: number;
  testUsdcBalance: number;
  testUsdcMint: string;
  tokenProgram: "spl-token" | "token-2022";
  escrowReady: boolean;
  allocatedBalance: number;
  mandateInitialized: boolean;
  mandateAddress: string;
  mandateVaultAddress: string;
  programId: string;
};

type WalletEvent = {
  id: string;
  actionType: "faucet" | "allocate" | "withdraw";
  amount: number;
  status: "pending" | "confirmed" | "failed";
  txSignature: string | null;
  createdAt: string;
};

type OnchainResponse = { ok: true; wallet: OnchainWallet; events: WalletEvent[] } | { ok: false; error: string };

export default function WalletWorkspace() {
  const trader = useTraderWallet();
  const { ready: walletsReady, wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const mandateActions = useMandateActions();
  const embeddedWallet = wallets[0] ?? null;
  const address = embeddedWallet?.address ?? null;
  const [review, setReview] = useState<WalletReview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [movementAction, setMovementAction] = useState<"allocate" | "withdraw" | null>(null);

  const { data, error, isLoading, mutate } = useSWR<OnchainResponse>(
    trader.authenticated && address ? ["devnet-wallet", address] : null,
    async () => {
      const token = await trader.getAccessToken();
      const response = await fetch(`/api/trader/wallet/onchain?address=${encodeURIComponent(address!)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json() as OnchainResponse;
      if (!response.ok) throw new Error("error" in body ? body.error : "WALLET_READ_FAILED");
      return body;
    },
    { refreshInterval: 20_000, revalidateOnFocus: true },
  );

  const onchain = data?.ok ? data.wallet : null;
  const events = data?.ok ? data.events : [];
  const allocated = onchain?.allocatedBalance ?? 0;
  const available = onchain?.testUsdcBalance ?? 0;
  const researchBalance = trader.wallet?.balance ?? 0;
  const walletReady = trader.ready && walletsReady;

  const status = useMemo(() => {
    if (!walletReady) return "Loading account";
    if (!trader.authenticated) return "Sign in required";
    if (!address) return "Wallet creation required";
    if (error) return "RPC unavailable";
    return "Devnet connected";
  }, [address, error, trader.authenticated, walletReady]);

  async function makeWallet() {
    setCreatingWallet(true);
    setNotice(null);
    try {
      await createWallet();
      setNotice("Your secure account is ready.");
    } catch (walletError) {
      setNotice((walletError as Error).message || "Wallet creation was cancelled.");
    } finally {
      setCreatingWallet(false);
    }
  }

  function openFaucetReview() {
    if (!address) return;
    setNotice(null);
    setReview(createWalletReview({ action: "faucet", amount: DAILY_FAUCET_LIMIT, destination: address }));
  }

  function openMovementReview(action: "allocate" | "withdraw", amount: number) {
    if (!onchain || !address) return;
    const maximum = action === "allocate" ? available : allocated;
    setMovementAction(null);
    setNotice(null);
    setReview(createWalletReview({
      action,
      amount,
      destination: action === "allocate" ? onchain.mandateVaultAddress : address,
      availableBalance: maximum,
      escrowReady: onchain.escrowReady,
    }));
  }

  if (!trader.ready) return <WalletSkeleton />;

  if (!trader.authenticated) {
    return (
      <div className="terminal-wallet mx-auto max-w-3xl py-10 text-center">
          <div className="telemetry-panel p-10 sm:p-16">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#21172f] text-[#bda9ff]"><Wallet className="size-7" /></span>
            <h1 className="mt-6 text-4xl font-black tracking-[-0.05em]">Your funds.</h1>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-[#675e72]">Sign in with email to get practice credits and choose how much ORA may use.</p>
            <button onClick={trader.login} className="mt-7 rounded-full bg-[#21172f] px-7 py-3.5 text-sm font-bold text-white">Sign in with email</button>
            <p className="mt-3 text-xs text-[#8a8295]">Practice mode only. No real money is accepted.</p>
          </div>
      </div>
    );
  }

  return (
    <div className="terminal-wallet mx-auto max-w-7xl">
      <div>
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8059e8]">You control the limit</p>
            <h1 className="mt-1 text-4xl font-black tracking-[-0.05em] text-[#21172f]">Funds and ORA budget</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#756d82]">Your available balance and ORA budget stay separate. ORA can only use the amount you choose.</p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            <span className="size-2 rounded-full bg-emerald-500" /> {status}
          </div>
        </div>

        {!address && walletsReady ? (
          <section className="ora-card rounded-3xl p-8 text-center">
            <LockKeyhole className="mx-auto size-8 text-[#8059e8]" />
            <h2 className="mt-4 text-2xl font-black">Set up your secure account</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#756d82]">Your account is protected by our wallet provider. TXAgent never receives your private key.</p>
            <button onClick={makeWallet} disabled={creatingWallet} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#21172f] px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
              {creatingWallet ? <LoaderCircle className="size-4 animate-spin" /> : <Wallet className="size-4" />} Set up account
            </button>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <section className="grid gap-4 sm:grid-cols-3">
                <BalanceCard label="Available" value={available} suffix="practice credits" icon={Wallet} accent="purple" loading={isLoading} />
                <BalanceCard label="ORA budget" value={allocated} suffix="practice credits" icon={Sparkles} accent="green" loading={isLoading} />
                <BalanceCard label="App balance" value={researchBalance} suffix="practice credits" icon={CircleDollarSign} accent="amber" loading={!trader.wallet} />
              </section>

              <section className="ora-card rounded-3xl p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8059e8]">Secure account</p>
                    <div className="mt-2 flex items-center gap-2">
                      <p className="font-mono text-lg font-black">{address ? shortAddress(address, 7, 7) : "Creating..."}</p>
                      {address && <CopyButton value={address} />}
                    </div>
                    <p className="mt-1 text-xs text-[#8a8295]">Ready for practice actions</p>
                  </div>
                  <button onClick={() => void mutate()} disabled={isLoading} className="inline-flex items-center gap-2 self-start rounded-full border border-[#ddd5e7] bg-white px-4 py-2 text-xs font-bold text-[#5e536d] disabled:opacity-50">
                    <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <ActionButton icon={Fuel} title="Get practice credits" detail="100 credits per day" onClick={openFaucetReview} enabled={Boolean(address && !error)} />
                  <ActionButton icon={ArrowDownToLine} title="Set ORA budget" detail={onchain?.escrowReady ? "Choose how much ORA may use" : "ORA budget setup is not ready"} onClick={() => setMovementAction("allocate")} enabled={Boolean(onchain?.escrowReady && available > 0)} />
                  <ActionButton icon={ArrowUpFromLine} title="Reduce ORA budget" detail={allocated > 0 ? "Return unused credits" : "No ORA budget to return"} onClick={() => setMovementAction("withdraw")} enabled={Boolean(onchain?.escrowReady && allocated > 0)} />
                </div>

                {notice && <div className="mt-4 rounded-2xl border border-[#ded5ea] bg-[#f7f3fb] px-4 py-3 text-xs leading-5 text-[#5f536e]">{notice}</div>}
              </section>

              <section className="ora-card rounded-3xl p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8059e8]">Funds activity</p>
                    <h2 className="mt-1 text-xl font-black">Recent changes</h2>
                  </div>
                  <History className="size-5 text-[#8059e8]" />
                </div>
                <div className="mt-4 space-y-2">
                  {events.length === 0 && <p className="rounded-2xl bg-[#f8f5fb] px-4 py-8 text-center text-xs text-[#8a8295]">No funds activity yet.</p>}
                  {events.map((event) => <EventRow key={event.id} event={event} />)}
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-3xl bg-[#21172f] p-5 text-white">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#bda9ff]"><ShieldCheck className="size-4" /> Your money rules</div>
                <h2 className="mt-3 text-xl font-black">ORA cannot exceed your budget.</h2>
                <p className="mt-2 text-xs leading-5 text-white/60">ORA can only use the amount you explicitly set aside. Everything else stays outside ORA’s reach.</p>
                <div className="mt-4 space-y-2 text-xs">
                  <BoundaryRow label="Account control" value="You" />
                  <BoundaryRow label="Current ORA budget" value={`${allocated.toFixed(2)} credits`} />
                  <BoundaryRow label="Mode" value="Practice" />
                </div>
              </section>

              <details className="ora-card rounded-3xl p-5">
                <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.16em] text-[#8059e8]">Technical details</summary>
                <dl className="mt-4 space-y-3 text-xs">
                  <Detail label="Cluster" value="Devnet" />
                  <Detail label="Token" value="test USDC" />
                  <Detail label="Token program" value={onchain?.tokenProgram ?? "Checking"} />
                  <Detail label="Mint" value={onchain ? shortAddress(onchain.testUsdcMint) : "Checking"} mono />
                  <Detail label="Escrow program" value={onchain ? shortAddress(onchain.programId) : "Checking"} mono />
                </dl>
              </details>

              <section className="rounded-3xl border border-[#f0d7a8] bg-[#fff8e9] p-4">
                <p className="text-xs font-bold text-[#6b4b16]">Practice mode</p>
                <p className="mt-1 text-[11px] leading-5 text-[#8a6c38]">Practice credits have no monetary value. Real-money deposits, withdrawals, and picks remain disabled.</p>
              </section>
            </aside>
          </div>
        )}
      </div>

      {review && address && (
        <TransactionReview
          review={review}
          getAccessToken={trader.getAccessToken}
          executeMovement={async (action, amount) => {
            const result = action === "allocate" ? await mandateActions.allocate(amount) : await mandateActions.withdraw(amount);
            const token = await trader.getAccessToken();
            await fetch("/api/trader/wallet/receipt", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ walletAddress: address, action, amount, signature: result.signature }),
            }).catch(() => null);
            return result;
          }}
          onClose={() => setReview(null)}
          onComplete={async (message) => {
            setReview(null);
            setNotice(message);
            await mutate();
          }}
        />
      )}
      {movementAction && (
        <AmountDialog
          action={movementAction}
          maximum={movementAction === "allocate" ? available : allocated}
          onClose={() => setMovementAction(null)}
          onContinue={(amount) => openMovementReview(movementAction, amount)}
        />
      )}
    </div>
  );
}

function TransactionReview({ review, getAccessToken, executeMovement, onClose, onComplete }: {
  review: WalletReview;
  getAccessToken: () => Promise<string | null>;
  executeMovement: (action: "allocate" | "withdraw", amount: number) => Promise<{ signature: string; simulationUnits: number | null }>;
  onClose: () => void;
  onComplete: (message: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      if (review.action !== "faucet") {
        await executeMovement(review.action, review.amount);
        await onComplete(`${review.action === "allocate" ? "ORA budget" : "Budget reduction"} confirmed.`);
        return;
      }
      const token = await getAccessToken();
      const response = await fetch("/api/trader/wallet/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          walletAddress: review.destination,
          amount: review.amount,
          confirmation: "GET_TEST_USDC_DEVNET",
        }),
      });
      const body = await response.json() as { ok?: boolean; error?: string; signature?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "FAUCET_REQUEST_FAILED");
      await onComplete(body.signature ? "Practice credits confirmed." : "Practice credits were already issued today.");
    } catch (requestError) {
      setError(humanWalletError((requestError as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#21172f]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Review funds action">
      <div className="w-full max-w-lg rounded-[30px] border border-white/60 bg-[#fbfaff] p-6 text-[#21172f] shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8059e8]">Review before confirming</p>
            <h2 className="mt-1 text-2xl font-black">{review.title}</h2>
          </div>
          <button onClick={onClose} disabled={submitting} aria-label="Close transaction review" className="rounded-full p-2 text-[#8a8295] hover:bg-[#eee8f4]"><X className="size-4" /></button>
        </div>

        <div className="mt-5 rounded-2xl bg-[#21172f] p-5 text-white">
          <p className="text-[10px] uppercase tracking-wider text-white/50">Amount</p>
          <p className="mt-1 text-3xl font-black tabular-nums">{review.amount.toFixed(2)} <span className="text-sm font-medium text-[#bda9ff]">{review.token}</span></p>
        </div>

        <dl className="mt-4 divide-y divide-[#e7e1ed] rounded-2xl border border-[#e7e1ed] bg-white px-4">
          <ReviewRow label="Destination" value={shortAddress(review.destination, 8, 8)} />
          <ReviewRow label="Paid by" value={review.feePayer} />
          <ReviewRow label="Mode" value="Practice" />
          <ReviewRow label="Safety check" value="Required" good />
        </dl>

        <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" /> TXAgent checks the account, tests the action safely, and only shows success after it is confirmed.
        </div>
        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onClose} disabled={submitting} className="rounded-full border border-[#d9d0e7] bg-white py-3 text-sm font-bold">Cancel</button>
          <button onClick={confirm} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#21172f] py-3 text-sm font-bold text-white disabled:opacity-50">
            {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Confirm action
          </button>
        </div>
      </div>
    </div>
  );
}

function AmountDialog({ action, maximum, onClose, onContinue }: {
  action: "allocate" | "withdraw";
  maximum: number;
  onClose: () => void;
  onContinue: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(Math.min(maximum, 10));
  const valid = Number.isFinite(amount) && amount > 0 && amount <= maximum && Math.round(amount * 100) === amount * 100;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#21172f]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${action} practice credits`}>
      <div className="w-full max-w-md rounded-[30px] border border-white/60 bg-[#fbfaff] p-6 text-[#21172f] shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8059e8]">Choose an amount</p>
            <h2 className="mt-1 text-2xl font-black">{action === "allocate" ? "Set ORA budget" : "Reduce ORA budget"}</h2>
          </div>
          <button onClick={onClose} aria-label="Close amount dialog" className="rounded-full p-2 text-[#8a8295] hover:bg-[#eee8f4]"><X className="size-4" /></button>
        </div>
        <label className="mt-6 block text-xs font-bold text-[#5f536e]" htmlFor="wallet-amount">Amount in practice credits</label>
        <div className="mt-2 flex items-center rounded-2xl border border-[#d9d0e7] bg-white px-4 focus-within:border-[#8059e8]">
          <input id="wallet-amount" type="number" min="0.01" max={maximum} step="0.01" value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="min-w-0 flex-1 bg-transparent py-4 text-2xl font-black tabular-nums outline-none" />
          <span className="text-xs font-bold text-[#8a8295]">credits</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-[#8a8295]">
          <span>Available {maximum.toFixed(2)}</span>
          <button onClick={() => setAmount(maximum)} className="font-bold text-[#8059e8]">Use maximum</button>
        </div>
        <p className="mt-5 rounded-2xl bg-[#f1ecf8] p-3 text-xs leading-5 text-[#5f536e]">You will review the amount and account before confirming.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-full border border-[#d9d0e7] bg-white py-3 text-sm font-bold">Cancel</button>
          <button onClick={() => onContinue(amount)} disabled={!valid} className="rounded-full bg-[#21172f] py-3 text-sm font-bold text-white disabled:opacity-40">Review action</button>
        </div>
      </div>
    </div>
  );
}

function BalanceCard({ label, value, suffix, icon: Icon, accent, loading }: { label: string; value: number; suffix: string; icon: typeof Wallet; accent: "purple" | "green" | "amber"; loading: boolean }) {
  const colors = accent === "green" ? "bg-emerald-50 text-emerald-600" : accent === "amber" ? "bg-amber-50 text-amber-600" : "bg-[#eee8ff] text-[#8059e8]";
  return <div className="ora-card rounded-3xl p-5"><div className={`grid size-10 place-items-center rounded-2xl ${colors}`}><Icon className="size-4.5" /></div><p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a8295]">{label}</p><p className="mt-1 text-2xl font-black tabular-nums">{loading ? "..." : value.toFixed(2)}</p><p className="text-[10px] text-[#8a8295]">{suffix}</p></div>;
}

function ActionButton({ icon: Icon, title, detail, onClick, enabled }: { icon: typeof Fuel; title: string; detail: string; onClick: () => void; enabled: boolean }) {
  return <button onClick={onClick} aria-disabled={!enabled} className={`rounded-2xl border p-4 text-left transition ${enabled ? "border-[#ded6e8] bg-white hover:border-[#a98cf8] hover:shadow-sm" : "border-[#ebe6ef] bg-[#faf8fb] text-[#9a93a2]"}`}><Icon className="size-5" /><p className="mt-3 text-sm font-black">{title}</p><p className="mt-1 text-[10px] leading-4 opacity-70">{detail}</p></button>;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <button aria-label="Copy wallet address" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="rounded-full p-1.5 text-[#8059e8] hover:bg-[#eee8ff]">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button>;
}

function EventRow({ event }: { event: WalletEvent }) {
  const label = event.actionType === "faucet" ? "Test funds" : event.actionType === "allocate" ? "ORA allocation" : "Allocation withdrawal";
  return <div className="flex items-center justify-between rounded-2xl border border-[#ebe5f0] bg-white px-4 py-3"><div><p className="text-xs font-bold">{label}</p><p className="mt-0.5 text-[10px] text-[#8a8295]">{new Date(event.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p></div><div className="text-right"><p className="text-xs font-black tabular-nums">{event.amount.toFixed(2)} test USDC</p><p className={event.status === "confirmed" ? "text-[9px] font-bold uppercase text-emerald-600" : event.status === "failed" ? "text-[9px] font-bold uppercase text-red-600" : "text-[9px] font-bold uppercase text-amber-600"}>{event.status}</p></div></div>;
}

function BoundaryRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span className="text-white/50">{label}</span><span className="font-bold">{value}</span></div>; }
function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="flex items-center justify-between gap-3"><dt className="text-[#8a8295]">{label}</dt><dd className={`${mono ? "font-mono" : "font-bold"} text-right text-[#50465f]`}>{value}</dd></div>; }
function ReviewRow({ label, value, good = false }: { label: string; value: string; good?: boolean }) { return <div className="flex items-center justify-between gap-4 py-3 text-xs"><dt className="text-[#8a8295]">{label}</dt><dd className={`text-right font-bold ${good ? "text-emerald-600" : "text-[#50465f]"}`}>{value}</dd></div>; }
function WalletSkeleton() { return <div className="terminal-wallet mx-auto h-96 max-w-6xl animate-pulse bg-[#11120f]" />; }

function humanWalletError(code: string): string {
  const messages: Record<string, string> = {
    DAILY_FAUCET_ALREADY_ATTEMPTED: "The daily test-fund request has already been used.",
    FAUCET_REQUEST_IN_PROGRESS: "Your test-fund request is already being processed.",
    DEVNET_FAUCET_SIMULATION_FAILED: "The devnet simulation failed, so nothing was broadcast.",
    DEVNET_FAUCET_NOT_CONFIGURED: "The test-fund service is temporarily unavailable.",
    ESCROW_PROGRAM_NOT_DEPLOYED: "The fresh devnet escrow program has not been deployed yet.",
    MANDATE_SIMULATION_FAILED: "The allocation simulation failed, so your wallet was not asked to sign.",
    MANDATE_CONFIRMATION_FAILED: "The transaction was submitted but did not confirm successfully.",
    NO_ORA_ALLOCATION: "There is no ORA allocation to withdraw.",
    WALLET_NOT_CONNECTED: "Your embedded Solana wallet is not connected.",
  };
  return messages[code] ?? "The request failed safely. No funds were moved.";
}
