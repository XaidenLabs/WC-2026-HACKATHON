import "server-only";
import { verifyPrivyToken, privyConfigured } from "./privy-server";

export class RequestAuthError extends Error {
  constructor(public readonly status: 401 | 503, message: string) {
    super(message);
  }
}

export async function requirePrivyDid(req: Request): Promise<string> {
  if (!privyConfigured()) throw new RequestAuthError(503, "AUTH_NOT_CONFIGURED");
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new RequestAuthError(401, "UNAUTHORIZED");
  try {
    return await verifyPrivyToken(token);
  } catch {
    throw new RequestAuthError(401, "UNAUTHORIZED");
  }
}
