import { NextResponse } from "next/server";
import { verifyPrivyToken, privyConfigured } from "@/lib/auth/privy-server";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

// Upsert the authenticated user into Supabase. The Privy access token is verified
// server-side first; the DB write uses the service-role key (server-only).
export async function POST(req: Request) {
  if (!privyConfigured() || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  }

  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "NO_TOKEN" }, { status: 401 });

  let did: string;
  try {
    did = await verifyPrivyToken(token); // <- the trust boundary
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const wallet = typeof body.wallet === "string" ? body.wallet : null;
  const email = typeof body.email === "string" ? body.email : null;

  const { error } = await supabaseAdmin()
    .from("users")
    .upsert(
      { privy_did: did, wallet, email, last_login_at: new Date().toISOString() },
      { onConflict: "privy_did" },
    );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, did });
}
