import WalletWorkspace from "@/components/WalletWorkspace";
import TraderShell from "@/components/TraderShell";

export default function WalletPage() {
  return (
    <TraderShell title="Wallet" subtitle="Devnet custody, ORA allocation, and transaction receipts.">
      <WalletWorkspace />
    </TraderShell>
  );
}
