import type { BttsOdds, Odds1X2, OraBttsModel, OraGoalsModel, OraModel1X2, OuOdds } from "@/lib/ora/pick";

export type MarketDataSource = "txline" | "sportmonks" | "hybrid";
export type MarketFixtureSource = "txline" | "sportmonks";

export type MarketScore = {
  home: number;
  away: number;
  minutes: number | null;
  isLive: boolean;
  isFinished: boolean;
  state: string;
};

export type MarketFixture = {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  Participant1Id: number;
  Participant2Id: number;
  Participant1IsHome: true;
  StartTime: number;
  Ts: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  source: MarketFixtureSource;
  score?: MarketScore;
};

export type MarketQuote = {
  fixtureId: number;
  source: MarketFixtureSource | "hybrid";
  bookmaker: { id: number; name: string } | null;
  updatedAt: string;
  odds: Odds1X2;
  model: OraModel1X2;
  ou: OuOdds;
  goalsModel: OraGoalsModel;
  goalModels: Array<NonNullable<OraGoalsModel>>;
  goalMarkets: Array<{ odds: NonNullable<OuOdds>; model: NonNullable<OraGoalsModel> }>;
  btts: BttsOdds;
  bttsModel: OraBttsModel;
};
