"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

// Email-first auth with a Solana embedded wallet. Keys remain inside Privy's wallet surface.
// If Privy is not configured, the public product still renders and auth actions remain unavailable.
export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <>{children}</>;

  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";
  const subscriptionsUrl = rpcUrl.replace(/^http/, "ws");

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#8059e8",
          logo: undefined,
        },
        loginMethods: ["email"],
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
          showWalletUIs: true,
        },
        solana: {
          rpcs: {
            "solana:devnet": {
              rpc: createSolanaRpc(rpcUrl),
              rpcSubscriptions: createSolanaRpcSubscriptions(subscriptionsUrl),
              blockExplorerUrl: "https://explorer.solana.com/?cluster=devnet",
            },
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
