export type MarketPreference = "winner" | "over_15" | "under_25" | "under_35" | "btts";

export type UserPreferences = {
  displayName: string;
  showAskOra: boolean;
  autoPickMode: "review_first" | "auto_after_timer" | "manual_only";
  reviewWindowMinutes: number;
  defaultStake: number;
  preferredMarkets: MarketPreference[];
  dataMode: "txline_first" | "sportmonks_first" | "both";
  compactMode: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  displayName: "",
  showAskOra: false,
  autoPickMode: "review_first",
  reviewWindowMinutes: 5,
  defaultStake: 50,
  preferredMarkets: ["winner", "over_15", "under_25", "btts"],
  dataMode: "txline_first",
  compactMode: true,
};

export const MARKET_LABELS: Record<MarketPreference, string> = {
  winner: "Match winner",
  over_15: "Over 1.5 goals",
  under_25: "Under 2.5 goals",
  under_35: "Under 3.5 goals",
  btts: "Both teams to score",
};

export function profileStorageKey(userId: string | null) {
  return `txagent.profile.${userId ?? "guest"}`;
}

export function normalisePreferences(input: Partial<UserPreferences> | null | undefined): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...input,
    preferredMarkets: input?.preferredMarkets?.length ? input.preferredMarkets : DEFAULT_PREFERENCES.preferredMarkets,
    reviewWindowMinutes: Number.isFinite(input?.reviewWindowMinutes) ? Number(input?.reviewWindowMinutes) : DEFAULT_PREFERENCES.reviewWindowMinutes,
    defaultStake: Number.isFinite(input?.defaultStake) ? Number(input?.defaultStake) : DEFAULT_PREFERENCES.defaultStake,
  };
}
