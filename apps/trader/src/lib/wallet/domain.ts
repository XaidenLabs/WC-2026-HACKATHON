export const DEVNET_CLUSTER = "devnet" as const;
export const TEST_USDC_DECIMALS = 6;
export const DAILY_FAUCET_LIMIT = 100;

export type WalletAction = "faucet" | "allocate" | "withdraw";

export type WalletReview = {
  action: WalletAction;
  title: string;
  amount: number;
  token: "test USDC";
  destination: string;
  feePayer: string;
  cluster: typeof DEVNET_CLUSTER;
  simulationRequired: true;
};

export function isValidDevnetConfig(cluster: string | undefined, rpc: string | undefined): boolean {
  if (cluster !== DEVNET_CLUSTER || !rpc) return false;
  try {
    const url = new URL(rpc);
    return url.protocol === "https:" && /devnet/i.test(url.hostname + url.pathname);
  } catch {
    return false;
  }
}

export function isValidAmount(amount: number, maximum: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= maximum && Math.round(amount * 100) === amount * 100;
}

export function createWalletReview(input: {
  action: WalletAction;
  amount: number;
  destination: string;
  availableBalance?: number;
  escrowReady?: boolean;
}): WalletReview {
  if (!input.destination) throw new Error("WALLET_ADDRESS_REQUIRED");
  const maximum = input.action === "faucet" ? DAILY_FAUCET_LIMIT : input.availableBalance ?? 0;
  if (!isValidAmount(input.amount, maximum)) throw new Error("INVALID_WALLET_AMOUNT");
  if (input.action !== "faucet" && !input.escrowReady) throw new Error("ESCROW_DEPLOYMENT_REQUIRED");

  const title = input.action === "faucet"
    ? "Get devnet test funds"
    : input.action === "allocate"
      ? "Allocate funds to ORA"
      : "Withdraw unused allocation";

  return {
    action: input.action,
    title,
    amount: input.amount,
    token: "test USDC",
    destination: input.destination,
    feePayer: input.action === "faucet" ? "TXAgent devnet faucet" : "Your embedded wallet",
    cluster: DEVNET_CLUSTER,
    simulationRequired: true,
  };
}

export function shortAddress(address: string, head = 5, tail = 5): string {
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}
