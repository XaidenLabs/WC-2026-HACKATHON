import { NextResponse } from "next/server";
import { RequestAuthError, requirePrivyDid } from "@/lib/auth/request";
import { devnetConnection } from "@/lib/agent/onchain";
import { readSupervision } from "@/lib/supervision/service";
import { getMarketFixtures } from "@/lib/market-data/server";

type HealthCheck = { ok: boolean; detail: string };

async function check(task: () => Promise<string>): Promise<HealthCheck> {
  try {
    return { ok: true, detail: await task() };
  } catch (error) {
    return { ok: false, detail: (error as Error).message.slice(0, 160) };
  }
}

export async function GET(req: Request) {
  try {
    const did = await requirePrivyDid(req);
    const [store, sportmonks, solana] = await Promise.all([
      check(async () => {
        const snapshot = await readSupervision(did);
        return `${snapshot.proposals.length} proposals`; 
      }),
      check(async () => {
        const fixtures = await getMarketFixtures();
        return `${fixtures.length} fixtures`;
      }),
      check(async () => {
        const version = await Promise.race([
          devnetConnection().getVersion().then((value) => value["solana-core"]),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("RPC_TIMEOUT")), 8_000)),
        ]);
        return `devnet ${version}`;
      }),
    ]);
    const scheduler: HealthCheck = process.env.CRON_SECRET
      ? { ok: true, detail: "protected cron configured" }
      : { ok: false, detail: "CRON_NOT_CONFIGURED" };
    const checks = { store, sportmonks, solana, scheduler };
    const ready = Object.values(checks).every((item) => item.ok);
    return NextResponse.json({
      ok: true,
      state: ready ? "ready" : "degraded",
      executionMode: "sportmonks_sandbox",
      cluster: "devnet",
      checkedAt: new Date().toISOString(),
      checks,
    }, { status: ready ? 200 : 207 });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
