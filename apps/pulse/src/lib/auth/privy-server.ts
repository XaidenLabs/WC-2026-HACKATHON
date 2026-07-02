import "server-only";
import { PrivyClient } from "@privy-io/server-auth";

let client: PrivyClient | null = null;
function privy(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Privy not configured (NEXT_PUBLIC_PRIVY_APP_ID / PRIVY_APP_SECRET)");
  }
  if (!client) client = new PrivyClient(appId, appSecret);
  return client;
}

/** Verify a Privy access token server-side. Returns the verified Privy DID, or throws. */
export async function verifyPrivyToken(token: string): Promise<string> {
  const claims = await privy().verifyAuthToken(token);
  return claims.userId;
}

export function privyConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}
