import "server-only";
import type { MarketFixture, MarketQuote, MarketScore } from "@/lib/market-data/types";
import type { BttsOdds, ModelQuality, Odds1X2, OraBttsModel, OraGoalsModel, OraModel1X2, OuOdds } from "@/lib/ora/pick";

const API_BASE = "https://api.sportmonks.com/v3/football";
const DEFAULT_LEAGUE_IDS = [8];
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_FIXTURE_DAYS = 31;

export class SportmonksTokenMissing extends Error {
  constructor() {
    super("SPORTMONKS_API_TOKEN_MISSING");
  }
}

export class SportmonksResponseError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

type ApiEnvelope<T> = { data?: T; message?: string };
type Participant = { id: number; name: string; meta?: { location?: "home" | "away" } };
type Score = {
  description?: string;
  participant?: "home" | "away";
  score?: { goals?: number; participant?: "home" | "away" };
};
type Fixture = {
  id: number;
  league_id: number;
  season_id: number;
  starting_at: string;
  name: string;
  updated_at?: string;
  participants?: Participant[];
  league?: { id: number; name: string };
  state?: { id: number; name: string; short_name: string; state: string };
  scores?: Score[];
  sidelined?: Array<{
    player?: { id?: number; name?: string; display_name?: string };
    type?: { name?: string; developer_name?: string };
    category?: string;
  }>;
};
type Odd = {
  id: number;
  fixture_id: number;
  market_id: number;
  bookmaker_id: number;
  label: string;
  value: string;
  stopped?: boolean;
  total?: string | null;
  latest_bookmaker_update?: string | null;
  updated_at?: string;
  bookmaker?: { id: number; name: string };
};
type Prediction = {
  fixture_id: number;
  type_id: number;
  predictions: Record<string, number | Record<string, number>>;
  type?: { developer_name?: string; code?: string; name?: string };
};
type Predictability = {
  type_id: number;
  data: Record<string, number | string>;
  type?: { developer_name?: string };
};

const predictabilityCache = new Map<number, { expiresAt: number; rows: Predictability[] }>();
const quoteCache = new Map<string, { freshUntil: number; staleUntil: number; quote: MarketQuote }>();
const quoteInflight = new Map<string, Promise<MarketQuote>>();

function apiToken(): string {
  const token = process.env.SPORTMONKS_API_TOKEN?.trim();
  if (!token) throw new SportmonksTokenMissing();
  return token;
}

function leagueIds(): number[] {
  const configured = (process.env.SPORTMONKS_LEAGUE_IDS ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  return configured.length ? [...new Set(configured)] : DEFAULT_LEAGUE_IDS;
}

async function sportmonksGet<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const response = await fetch(`${API_BASE}${path}${query.size ? `?${query}` : ""}`, {
    headers: { Accept: "application/json", Authorization: apiToken() },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.data) {
    throw new SportmonksResponseError(response.status, payload?.message ?? `SPORTMONKS_HTTP_${response.status}`);
  }
  return payload.data;
}

function utcMs(value: string): number {
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) throw new Error("SPORTMONKS_INVALID_TIMESTAMP");
  return parsed;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function fixtureScore(fixture: Fixture): MarketScore | undefined {
  const state = fixture.state?.state?.toLowerCase() ?? "";
  const short = fixture.state?.short_name?.toUpperCase() ?? "";
  const finished = state === "finished" || ["FT", "AET", "PEN", "AWARDED"].includes(short);
  const live = state === "inplay" || state === "live";
  const current = (fixture.scores ?? []).filter((score) => score.description === "CURRENT");
  const pool = current.length ? current : (fixture.scores ?? []);
  const home = pool.find((score) => (score.participant ?? score.score?.participant) === "home")?.score?.goals;
  const away = pool.find((score) => (score.participant ?? score.score?.participant) === "away")?.score?.goals;
  if (!Number.isFinite(home) && !Number.isFinite(away) && !live && !finished) return undefined;
  return {
    home: Number.isFinite(home) ? Number(home) : 0,
    away: Number.isFinite(away) ? Number(away) : 0,
    minutes: null,
    isLive: live,
    isFinished: finished,
    state: fixture.state?.name ?? fixture.state?.short_name ?? "Scheduled",
  };
}

function normalizeFixture(fixture: Fixture): MarketFixture | null {
  const home = fixture.participants?.find((participant) => participant.meta?.location === "home");
  const away = fixture.participants?.find((participant) => participant.meta?.location === "away");
  if (!Number.isSafeInteger(fixture.id) || !home || !away) return null;
  const startTime = utcMs(fixture.starting_at);
  return {
    FixtureId: fixture.id,
    Participant1: home.name,
    Participant2: away.name,
    Participant1Id: home.id,
    Participant2Id: away.id,
    Participant1IsHome: true,
    StartTime: startTime,
    Ts: fixture.updated_at ? utcMs(fixture.updated_at) : startTime,
    Competition: fixture.league?.name ?? `League ${fixture.league_id}`,
    CompetitionId: fixture.league_id,
    FixtureGroupId: fixture.season_id,
    source: "sportmonks",
    score: fixtureScore(fixture),
  };
}

export async function getSportmonksFixtures(input: { fromMs?: number; toMs?: number; fixtureId?: number } = {}): Promise<MarketFixture[]> {
  if (input.fixtureId != null) {
    if (!Number.isSafeInteger(input.fixtureId) || input.fixtureId <= 0) throw new Error("BAD_FIXTURE_ID");
    const fixture = await sportmonksGet<Fixture>(`/fixtures/${input.fixtureId}`, {
      include: "participants;league;state;scores",
    });
    const normalized = normalizeFixture(fixture);
    return normalized ? [normalized] : [];
  }

  const fromMs = input.fromMs ?? Date.now() - 6 * 60 * 60 * 1_000;
  const requestedTo = input.toMs ?? Date.now() + 21 * 86_400_000;
  const toMs = Math.min(requestedTo, fromMs + MAX_FIXTURE_DAYS * 86_400_000);
  const fixtures = await sportmonksGet<Fixture[]>(`/fixtures/between/${isoDate(fromMs)}/${isoDate(toMs)}`, {
    filters: `fixtureLeagues:${leagueIds().join(",")}`,
    include: "participants;league;state;scores",
    per_page: "100",
  });
  return fixtures.map(normalizeFixture).filter((fixture): fixture is MarketFixture => fixture != null);
}

export type SportmonksFixtureContext = {
  fixtureId: number;
  home: { id: number; name: string };
  away: { id: number; name: string };
  sidelined: Array<{ player: string; reason: string }>;
  recentFixtures: Array<{ name: string; startTime: string; score: string | null; state: string }>;
  headToHead: Array<{ name: string; startTime: string; score: string | null; state: string }>;
  limitations: string[];
};

function contextFixture(fixture: Fixture): { name: string; startTime: string; score: string | null; state: string } {
  const score = fixtureScore(fixture);
  return {
    name: fixture.name,
    startTime: fixture.starting_at,
    score: score ? `${score.home}-${score.away}` : null,
    state: fixture.state?.name ?? fixture.state?.short_name ?? "Unknown",
  };
}

/** Fetches explainability evidence. Missing plan entitlements fail soft and are disclosed. */
export async function getSportmonksFixtureContext(fixtureId: number): Promise<SportmonksFixtureContext> {
  if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) throw new Error("BAD_FIXTURE_ID");
  const fixture = await sportmonksGet<Fixture>(`/fixtures/${fixtureId}`, {
    include: "participants;league;state;scores;sidelined.player;sidelined.type",
  });
  const home = fixture.participants?.find((participant) => participant.meta?.location === "home");
  const away = fixture.participants?.find((participant) => participant.meta?.location === "away");
  if (!home || !away) throw new Error("SPORTMONKS_PARTICIPANTS_UNAVAILABLE");

  const from = isoDate(Date.now() - 180 * 86_400_000);
  const to = isoDate(Date.now());
  const [homeRecent, awayRecent, headToHead] = await Promise.allSettled([
    sportmonksGet<Fixture[]>(`/fixtures/between/${from}/${to}/${home.id}`, { include: "participants;state;scores", per_page: "10" }),
    sportmonksGet<Fixture[]>(`/fixtures/between/${from}/${to}/${away.id}`, { include: "participants;state;scores", per_page: "10" }),
    sportmonksGet<Fixture[]>(`/fixtures/head-to-head/${home.id}/${away.id}`, { include: "participants;state;scores", per_page: "10" }),
  ]);
  const limitations: string[] = [];
  if (homeRecent.status === "rejected" || awayRecent.status === "rejected") limitations.push("Recent team fixtures were not fully available on the current data plan.");
  if (headToHead.status === "rejected") limitations.push("Head-to-head history was not available on the current data plan.");

  const recentRows = [
    ...(homeRecent.status === "fulfilled" ? homeRecent.value.toSorted((a, b) => utcMs(b.starting_at) - utcMs(a.starting_at)).slice(0, 5) : []),
    ...(awayRecent.status === "fulfilled" ? awayRecent.value.toSorted((a, b) => utcMs(b.starting_at) - utcMs(a.starting_at)).slice(0, 5) : []),
  ];
  const uniqueRecent = [...new Map(recentRows.map((row) => [row.id, row])).values()]
    .toSorted((a, b) => utcMs(b.starting_at) - utcMs(a.starting_at))
    .slice(0, 10)
    .map(contextFixture);
  const h2hRows = headToHead.status === "fulfilled"
    ? headToHead.value.toSorted((a, b) => utcMs(b.starting_at) - utcMs(a.starting_at)).slice(0, 5).map(contextFixture)
    : [];

  return {
    fixtureId,
    home: { id: home.id, name: home.name },
    away: { id: away.id, name: away.name },
    sidelined: (fixture.sidelined ?? []).map((entry) => ({
      player: entry.player?.display_name ?? entry.player?.name ?? "Unknown player",
      reason: entry.type?.name ?? entry.type?.developer_name ?? entry.category ?? "Unavailable",
    })),
    recentFixtures: uniqueRecent,
    headToHead: h2hRows,
    limitations,
  };
}

function validDecimal(value: string): number | null {
  const decimal = Number(value);
  return Number.isFinite(decimal) && decimal > 1 && decimal <= 1_000 ? decimal : null;
}

function oddTime(odd: Odd): number {
  const value = odd.latest_bookmaker_update ?? odd.updated_at;
  return value ? utcMs(value) : 0;
}

type CompleteBook = {
  bookmaker: { id: number; name: string };
  odds: Odds1X2;
  updatedAt: number;
  overround: number;
};

function bestComplete1X2(rows: Odd[]): CompleteBook | null {
  const books = new Map<number, Odd[]>();
  for (const row of rows) {
    if (row.market_id !== 1 || row.stopped || validDecimal(row.value) == null) continue;
    books.set(row.bookmaker_id, [...(books.get(row.bookmaker_id) ?? []), row]);
  }
  const candidates: CompleteBook[] = [];
  for (const [bookmakerId, bookRows] of books) {
    const byLabel = (label: string) => bookRows
      .filter((row) => row.label.toLowerCase() === label)
      .toSorted((a, b) => oddTime(b) - oddTime(a))[0];
    const home = byLabel("home");
    const draw = byLabel("draw");
    const away = byLabel("away");
    if (!home || !draw || !away) continue;
    const decimals = [validDecimal(home.value), validDecimal(draw.value), validDecimal(away.value)];
    if (decimals.some((value) => value == null)) continue;
    const [homeDec, drawDec, awayDec] = decimals as [number, number, number];
    const inverse = [1 / homeDec, 1 / drawDec, 1 / awayDec];
    const total = inverse.reduce((sum, value) => sum + value, 0);
    const updatedAt = Math.min(oddTime(home), oddTime(draw), oddTime(away));
    candidates.push({
      bookmaker: { id: bookmakerId, name: home.bookmaker?.name ?? `Bookmaker ${bookmakerId}` },
      odds: {
        home: { dec: homeDec, pct: inverse[0] / total * 100 },
        draw: { dec: drawDec, pct: inverse[1] / total * 100 },
        away: { dec: awayDec, pct: inverse[2] / total * 100 },
      },
      updatedAt,
      overround: total,
    });
  }
  return candidates.toSorted((a, b) => b.updatedAt - a.updatedAt || a.overround - b.overround)[0] ?? null;
}

function qualityFor(rows: Predictability[], market: string): ModelQuality {
  const dataFor = (developerName: string) => rows.find((row) => row.type?.developer_name === developerName)?.data?.[market];
  const hitRatio = Number(dataFor("MODEL_HIT_RATIO"));
  const predictability = String(dataFor("MODEL_PREDICTABILITY") ?? "unknown").toLowerCase();
  const predictivePower = String(dataFor("MODEL_PREDICTIVE_POWER") ?? "unknown").toLowerCase();
  return {
    hitRatio: Number.isFinite(hitRatio) ? hitRatio : null,
    predictability: ["poor", "medium", "good", "high"].includes(predictability)
      ? predictability as ModelQuality["predictability"]
      : "unknown",
    predictivePower: ["up", "down", "unchanged"].includes(predictivePower)
      ? predictivePower as ModelQuality["predictivePower"]
      : "unknown",
  };
}

async function getPredictability(leagueId: number): Promise<Predictability[]> {
  const cached = predictabilityCache.get(leagueId);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;
  const rows = await sportmonksGet<Predictability[]>(`/predictions/predictability/leagues/${leagueId}`, { include: "type" });
  predictabilityCache.set(leagueId, { expiresAt: Date.now() + 15 * 60_000, rows });
  return rows;
}

function normalizeModel(values: Record<string, unknown>, quality: ModelQuality): OraModel1X2 | null {
  const home = Number(values.home);
  const draw = Number(values.draw);
  const away = Number(values.away);
  const total = home + draw + away;
  if (![home, draw, away, total].every(Number.isFinite) || home <= 0 || draw <= 0 || away <= 0 || total < 95 || total > 105) return null;
  return { home: home / total * 100, draw: draw / total * 100, away: away / total * 100, source: "sportmonks", quality };
}

function predictionModel(rows: Prediction[], quality: ModelQuality): OraModel1X2 | null {
  const fulltime = rows.find((row) => row.type?.developer_name === "FULLTIME_RESULT_PROBABILITY" || row.type_id === 237);
  return fulltime ? normalizeModel(fulltime.predictions, quality) : null;
}

function goalsModel(rows: Prediction[], line: number, quality: ModelQuality): OraGoalsModel | null {
  const typeByLine: Record<string, number> = { "1.5": 234, "2.5": 235, "3.5": 236, "4.5": 1679 };
  const row = rows.find((prediction) => prediction.type_id === typeByLine[line.toFixed(1)]);
  if (!row) return null;
  const over = Number(row.predictions.yes);
  const under = Number(row.predictions.no);
  const total = over + under;
  if (![over, under, total].every(Number.isFinite) || over <= 0 || under <= 0 || total < 95 || total > 105) return null;
  return { line, over: over / total * 100, under: under / total * 100, source: "sportmonks", quality };
}

function bttsModel(rows: Prediction[], quality: ModelQuality): OraBttsModel | null {
  const row = rows.find((prediction) => prediction.type_id === 231);
  if (!row) return null;
  const yes = Number(row.predictions.yes);
  const no = Number(row.predictions.no);
  const total = yes + no;
  if (![yes, no, total].every(Number.isFinite) || yes <= 0 || no <= 0 || total < 95 || total > 105) return null;
  return { yes: yes / total * 100, no: no / total * 100, source: "sportmonks", quality };
}

function allTotals(rows: Odd[]): Array<{ odds: NonNullable<OuOdds>; updatedAt: number; overround: number }> {
  const grouped = new Map<string, Odd[]>();
  for (const row of rows) {
    if (row.market_id !== 80 || row.stopped || !row.total || validDecimal(row.value) == null) continue;
    const key = `${row.bookmaker_id}:${row.total}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const candidates: Array<{ line: number; updatedAt: number; overround: number; odds: NonNullable<OuOdds> }> = [];
  for (const rowsForLine of grouped.values()) {
    const over = rowsForLine.find((row) => row.label.toLowerCase() === "over");
    const under = rowsForLine.find((row) => row.label.toLowerCase() === "under");
    const line = Number(over?.total ?? under?.total);
    const overDec = over && validDecimal(over.value);
    const underDec = under && validDecimal(under.value);
    if (!over || !under || !overDec || !underDec || !Number.isFinite(line)) continue;
    const inverse = [1 / overDec, 1 / underDec];
    const total = inverse[0] + inverse[1];
    candidates.push({
      line,
      updatedAt: Math.min(oddTime(over), oddTime(under)),
      overround: total,
      odds: {
        line: line.toFixed(1),
        over: { dec: overDec, pct: inverse[0] / total * 100 },
        under: { dec: underDec, pct: inverse[1] / total * 100 },
      },
    });
  }
  const bestByLine = new Map<number, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const current = bestByLine.get(candidate.line);
    if (!current || candidate.updatedAt > current.updatedAt || (candidate.updatedAt === current.updatedAt && candidate.overround < current.overround)) {
      bestByLine.set(candidate.line, candidate);
    }
  }
  return [...bestByLine.values()].toSorted((a, b) => a.line - b.line);
}

function bestBtts(rows: Odd[]): { odds: NonNullable<BttsOdds>; updatedAt: number; overround: number } | null {
  const books = new Map<number, Odd[]>();
  for (const row of rows) {
    if (row.market_id !== 14 || row.stopped || validDecimal(row.value) == null) continue;
    books.set(row.bookmaker_id, [...(books.get(row.bookmaker_id) ?? []), row]);
  }
  const candidates: Array<{ odds: NonNullable<BttsOdds>; updatedAt: number; overround: number }> = [];
  for (const bookRows of books.values()) {
    const newest = (label: string) => bookRows
      .filter((row) => row.label.toLowerCase() === label)
      .toSorted((a, b) => oddTime(b) - oddTime(a))[0];
    const yes = newest("yes");
    const no = newest("no");
    const yesDec = yes && validDecimal(yes.value);
    const noDec = no && validDecimal(no.value);
    if (!yes || !no || !yesDec || !noDec) continue;
    const inverse = [1 / yesDec, 1 / noDec];
    const total = inverse[0] + inverse[1];
    candidates.push({
      odds: {
        yes: { dec: yesDec, pct: inverse[0] / total * 100 },
        no: { dec: noDec, pct: inverse[1] / total * 100 },
      },
      updatedAt: Math.min(oddTime(yes), oddTime(no)),
      overround: total,
    });
  }
  return candidates.toSorted((a, b) => b.updatedAt - a.updatedAt || a.overround - b.overround)[0] ?? null;
}

async function fetchSportmonksQuote(fixtureId: number, leagueId: number): Promise<MarketQuote> {
  if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) throw new Error("BAD_FIXTURE_ID");
  const [oddRows, predictionRows, predictabilityRows] = await Promise.all([
    sportmonksGet<Odd[]>(`/odds/pre-match/fixtures/${fixtureId}`, {
      filters: "markets:1,14,80",
      include: "bookmaker;market",
    }),
    sportmonksGet<Prediction[]>(`/predictions/probabilities/fixtures/${fixtureId}`, { include: "type" }),
    getPredictability(leagueId),
  ]);
  const book = bestComplete1X2(oddRows);
  const model = predictionModel(predictionRows, qualityFor(predictabilityRows, "fulltime_result"));
  if (!model) throw new Error("SPORTMONKS_1X2_PREDICTION_UNAVAILABLE");
  const maxAgeMinutes = Number(process.env.SPORTMONKS_MAX_ODDS_AGE_MINUTES ?? 1_440);
  if (book && book.updatedAt > 0 && Date.now() - book.updatedAt > maxAgeMinutes * 60_000) throw new Error("SPORTMONKS_ODDS_STALE");
  const totalQuotes = allTotals(oddRows);
  const supportedGoalLines = [1.5, 2.5, 3.5, 4.5];
  const goalModels = supportedGoalLines.flatMap((line) => {
    const model = goalsModel(predictionRows, line, qualityFor(predictabilityRows, `over_under_${line.toFixed(1).replace(".", "_")}`));
    return model ? [model] : [];
  });
  const goalMarkets = totalQuotes.flatMap(({ odds }) => {
    const line = Number(odds.line);
    const model = goalModels.find((candidate) => Math.abs(candidate.line - line) < 0.001) ?? null;
    return model ? [{ odds, model }] : [];
  });
  const preferredGoals = goalMarkets.find((item) => Number(item.odds.line) === 2.5) ?? goalMarkets[0] ?? null;
  const bttsQuote = bestBtts(oddRows);
  return {
    fixtureId,
    source: "sportmonks",
    bookmaker: book?.bookmaker ?? null,
    updatedAt: new Date(book?.updatedAt || Date.now()).toISOString(),
    odds: book?.odds ?? null,
    model,
    ou: preferredGoals?.odds ?? null,
    goalsModel: preferredGoals?.model ?? null,
    goalModels,
    goalMarkets,
    btts: bttsQuote?.odds ?? null,
    bttsModel: bttsModel(predictionRows, qualityFor(predictabilityRows, "both_teams_to_score")),
  };
}

export async function getSportmonksQuote(fixtureId: number, leagueId = leagueIds()[0]): Promise<MarketQuote> {
  if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) throw new Error("BAD_FIXTURE_ID");
  const key = `${fixtureId}:${leagueId}`;
  const cached = quoteCache.get(key);
  if (cached && cached.freshUntil > Date.now()) return cached.quote;
  const active = quoteInflight.get(key);
  if (active) return active;

  const request = fetchSportmonksQuote(fixtureId, leagueId)
    .then((quote) => {
      quoteCache.set(key, {
        freshUntil: Date.now() + 60_000,
        staleUntil: Date.now() + 10 * 60_000,
        quote,
      });
      return quote;
    })
    .catch((error) => {
      if (cached && cached.staleUntil > Date.now()) return cached.quote;
      throw error;
    })
    .finally(() => quoteInflight.delete(key));
  quoteInflight.set(key, request);
  return request;
}
