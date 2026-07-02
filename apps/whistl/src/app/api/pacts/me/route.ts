import { NextResponse } from "next/server";
import { verifyPrivyToken, privyConfigured } from "@/lib/auth/privy-server";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

/**
 * GET /api/pacts/me — Returns all pacts created by the authenticated user.
 * Requires: Authorization: Bearer <privy-access-token>
 */
export async function GET(req: Request) {
  if (!privyConfigured() || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "NOT_CONFIGURED" }, { status: 503 });
  }

  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "NO_TOKEN" }, { status: 401 });

  let userDid: string;
  try {
    userDid = await verifyPrivyToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 401 });
  }

  const { data: pacts, error } = await supabaseAdmin()
    .from("pacts")
    .select("*")
    .eq("creator_did", userDid)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[GET /api/pacts/me]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pacts: pacts ?? [] });
}
