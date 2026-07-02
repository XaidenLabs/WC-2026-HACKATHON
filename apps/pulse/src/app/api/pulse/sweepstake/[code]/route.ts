import { NextResponse } from "next/server";
import { getSweepstake, listMembers } from "@/lib/pulse/sweepstore";
import { computeAllStandings } from "@/lib/pulse/tournament";

export type LeaderRow = {
  name: string;
  team: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  goalsFor: number;
  live: boolean;
};

// GET /api/pulse/sweepstake/[code] — group info + live leaderboard.
// Member ids (private handles) are NOT exposed here.
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params;
  const code = raw.toUpperCase();

  try {
    const sweepstake = await getSweepstake(code);
    if (!sweepstake) {
      return NextResponse.json({ ok: false, error: "GROUP_NOT_FOUND" }, { status: 404 });
    }

    const [members, standings] = await Promise.all([listMembers(code), computeAllStandings()]);

    const leaderboard: LeaderRow[] = members
      .map((m) => {
        const s = standings[m.team];
        return {
          name: m.name,
          team: m.team,
          points: s?.points ?? 0,
          played: s?.played ?? 0,
          won: s?.won ?? 0,
          drawn: s?.drawn ?? 0,
          goalsFor: s?.goalsFor ?? 0,
          live: s?.live ?? false,
        };
      })
      .sort((a, b) => b.points - a.points || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team));

    return NextResponse.json({
      ok: true,
      sweepstake: { code: sweepstake.code, name: sweepstake.name },
      memberCount: members.length,
      leaderboard,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
