import assert from "node:assert/strict";
import test from "node:test";
import { oraBttsPick, oraGoalsPick, oraPick, payoutOn } from "./pick.ts";

const balanced = {
  home: { dec: 2.7, pct: 36 },
  draw: { dec: 3.2, pct: 31 },
  away: { dec: 3, pct: 33 },
};
const quality = { hitRatio: 0.52, predictability: "good" as const, predictivePower: "up" as const };
const model = { home: 42, draw: 30, away: 28, source: "sportmonks" as const, quality };

test("ORA is deterministic for the same market snapshot", () => {
  assert.deepEqual(oraPick(balanced, model), oraPick(structuredClone(balanced), structuredClone(model)));
});

test("ORA rejects malformed, impossible, and incomplete 1X2 prices", () => {
  assert.equal(oraPick(null, model), null);
  assert.equal(oraPick(balanced, null), null);
  assert.equal(oraPick({ ...balanced, home: { dec: Number.NaN, pct: 36 } }, model), null);
  assert.equal(oraPick({ ...balanced, draw: { dec: 3.2, pct: null } }, model), null);
  assert.equal(oraPick({ ...balanced, away: { dec: 3, pct: 2 } }, model), null);
  assert.equal(oraPick({ ...balanced, away: { dec: 2_000, pct: 33 } }, model), null);
});

test("a valid pick exposes internally consistent model and EV metrics", () => {
  const pick = oraPick(balanced, model);
  assert.ok(pick);
  assert.ok(["home", "draw", "away"].includes(pick.selection));
  assert.ok(pick.prob > 0 && pick.prob <= 100);
  assert.ok(pick.marketProb > 0 && pick.marketProb <= 100);
  assert.equal(pick.edge, pick.prob - pick.marketProb);
  assert.equal(pick.value, pick.tier !== "pass");
});

test("goals pricing rejects invalid totals and impossible lines", () => {
  const goalsModel = { line: 2.5, over: 55, under: 45, source: "sportmonks" as const, quality };
  assert.equal(oraGoalsPick({ line: "2.5", over: { dec: 1.9, pct: 20 }, under: { dec: 1.9, pct: 20 } }, goalsModel), null);
  assert.equal(oraGoalsPick({ line: "-1", over: { dec: 1.9, pct: 50 }, under: { dec: 1.9, pct: 50 } }, goalsModel), null);
});

test("ORA fails closed when the external model and market disagree beyond measured quality", () => {
  const suspicious = { home: 60, draw: 20, away: 20, source: "sportmonks" as const, quality };
  const pick = oraPick(balanced, suspicious);
  assert.ok(pick);
  assert.equal(pick.value, false);
  assert.equal(pick.tier, "pass");
  assert.match(pick.reasoning, /safety limit/);
});

test("BTTS pricing removes vig and returns the strongest valid side", () => {
  const pick = oraBttsPick(
    { yes: { dec: 2.5, pct: 37.5 }, no: { dec: 1.5, pct: 62.5 } },
    { yes: 44, no: 56, source: "sportmonks", quality },
  );
  assert.ok(pick);
  assert.equal(pick.selection, "yes");
  assert.equal(pick.label, "BTTS Yes");
  assert.equal(pick.value, true);
});

test("BTTS fails closed on incomplete quotes and excessive disagreement", () => {
  assert.equal(oraBttsPick(null, { yes: 50, no: 50, source: "sportmonks", quality }), null);
  const pick = oraBttsPick(
    { yes: { dec: 2, pct: 50 }, no: { dec: 2, pct: 50 } },
    { yes: 80, no: 20, source: "sportmonks", quality },
  );
  assert.ok(pick);
  assert.equal(pick.value, false);
  assert.match(pick.reasoning, /safety limit/);
});

test("payout uses currency rounding", () => {
  assert.equal(payoutOn(12.34, 2.105), 25.98);
});
