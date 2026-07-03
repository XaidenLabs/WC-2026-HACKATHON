"use client";

import { PrivyProvider } from "@privy-io/react-auth";

// Minimal auth for the paper-trading wallet — email login (fastest for users, no wallet or
// funding needed). If Privy isn't configured, the app still renders (auth just no-ops).
export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#10b981",
          logo: undefined,
        },
        loginMethods: ["email"],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
