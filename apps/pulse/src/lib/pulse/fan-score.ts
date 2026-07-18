"use client";

const KEY = "pulse_fan_score_v1";

export type FanScore = { points: number; wins: number; resolved: string[] };
const EMPTY: FanScore = { points: 0, wins: 0, resolved: [] };

export function readFanScore(): FanScore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<FanScore> | null;
    return raw && Array.isArray(raw.resolved)
      ? { points: Number(raw.points) || 0, wins: Number(raw.wins) || 0, resolved: raw.resolved }
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function settleFanPrediction(id: string, won: boolean): FanScore {
  const current = readFanScore();
  if (current.resolved.includes(id)) return current;
  const next: FanScore = {
    points: current.points + (won ? 100 : 0),
    wins: current.wins + (won ? 1 : 0),
    resolved: [...current.resolved, id].slice(-100),
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
