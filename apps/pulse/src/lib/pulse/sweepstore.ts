import "server-only";
import { randomUUID } from "crypto";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";
import { getTeamPool } from "@/lib/pulse/tournament";

// Sweepstake persistence. Prefers Supabase (tables `sweepstakes` + `sweep_members`, created
// via supabase/sweepstakes.sql). If those tables are missing or Supabase is unconfigured, it
// transparently falls back to an in-memory store so the feature still works in a local demo.

export type Sweepstake = { code: string; name: string; created_at: string };
export type Member = {
  id: string;
  code: string;
  name: string;
  team: string;
  is_creator: boolean;
  joined_at: string;
};

// ── Backend resolution (probe once per process) ────────────────────────────────
let backend: "supabase" | "memory" | null = null;

async function resolveBackend(): Promise<"supabase" | "memory"> {
  if (backend) return backend;
  if (!supabaseConfigured()) {
    backend = "memory";
    return backend;
  }
  const { error } = await supabaseAdmin().from("sweepstakes").select("code").limit(1);
  backend = error ? "memory" : "supabase";
  if (error) {
    console.warn(
      "[sweepstake] tables not found — using in-memory store. Run supabase/sweepstakes.sql to persist.",
    );
  }
  return backend;
}

// In-memory fallback store.
const memSweeps = new Map<string, Sweepstake>();
const memMembers = new Map<string, Member[]>(); // code -> members

// ── Helpers ────────────────────────────────────────────────────────────────────
function newCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function assignTeam(taken: string[]): Promise<string> {
  const pool = await getTeamPool();
  if (!pool.length) return "TBD";
  const free = pool.filter((t) => !taken.includes(t));
  const from = free.length ? free : pool; // reuse once everyone has a unique team
  return from[Math.floor(Math.random() * from.length)];
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function createSweepstake(name: string, creatorName: string): Promise<{ sweepstake: Sweepstake; member: Member }> {
  const code = newCode();
  const created_at = new Date().toISOString();
  const sweepstake: Sweepstake = { code, name, created_at };
  const team = await assignTeam([]);
  const member: Member = {
    id: randomUUID(),
    code,
    name: creatorName,
    team,
    is_creator: true,
    joined_at: created_at,
  };

  if ((await resolveBackend()) === "supabase") {
    const db = supabaseAdmin();
    await db.from("sweepstakes").insert({ code, name });
    await db.from("sweep_members").insert({
      id: member.id, code, name: creatorName, team, is_creator: true,
    });
  } else {
    memSweeps.set(code, sweepstake);
    memMembers.set(code, [member]);
  }
  return { sweepstake, member };
}

export async function getSweepstake(code: string): Promise<Sweepstake | null> {
  if ((await resolveBackend()) === "supabase") {
    const { data } = await supabaseAdmin().from("sweepstakes").select("*").eq("code", code).single();
    return (data as Sweepstake) ?? null;
  }
  return memSweeps.get(code) ?? null;
}

export async function listMembers(code: string): Promise<Member[]> {
  if ((await resolveBackend()) === "supabase") {
    const { data } = await supabaseAdmin()
      .from("sweep_members")
      .select("*")
      .eq("code", code)
      .order("joined_at", { ascending: true });
    return (data as Member[]) ?? [];
  }
  return memMembers.get(code) ?? [];
}

export async function joinSweepstake(code: string, name: string): Promise<Member | null> {
  const sweepstake = await getSweepstake(code);
  if (!sweepstake) return null;

  const existing = await listMembers(code);
  const team = await assignTeam(existing.map((m) => m.team));
  const member: Member = {
    id: randomUUID(),
    code,
    name,
    team,
    is_creator: false,
    joined_at: new Date().toISOString(),
  };

  if ((await resolveBackend()) === "supabase") {
    await supabaseAdmin().from("sweep_members").insert({ id: member.id, code, name, team, is_creator: false });
  } else {
    memMembers.set(code, [...existing, member]);
  }
  return member;
}
