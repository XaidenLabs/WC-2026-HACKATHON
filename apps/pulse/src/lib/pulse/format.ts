// Small presentation helpers shared across WHISTL Pulse fan screens.

export type MatchPhase = "live" | "upcoming" | "finished";

// A match has no explicit status in the fixtures snapshot, so we infer phase from
// kickoff time. ~2.5h covers 90' + half-time + stoppage + a buffer.
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1000;

export function matchPhase(startTimeMs: number, now = Date.now()): MatchPhase {
  if (now < startTimeMs) return "upcoming";
  if (now < startTimeMs + LIVE_WINDOW_MS) return "live";
  return "finished";
}

/** "Today 18:00" / "Tomorrow 21:00" / "Sat 12 Jul 18:00" — or LIVE / FT badges. */
export function kickoffLabel(startTimeMs: number, now = Date.now()): string {
  const phase = matchPhase(startTimeMs, now);
  if (phase === "live") return "LIVE";
  if (phase === "finished") return "FULL TIME";

  const d = new Date(startTimeMs);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} ${time}`;
}

/** Three-letter-ish country/team code for compact score rows. */
export function teamCode(name: string): string {
  const clean = name.trim();
  if (clean.length <= 3) return clean.toUpperCase();
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    // "South Africa" → "SAF", "Saudi Arabia" → "SAU"
    return (words[0][0] + words[1].slice(0, 2)).toUpperCase();
  }
  return clean.slice(0, 3).toUpperCase();
}
