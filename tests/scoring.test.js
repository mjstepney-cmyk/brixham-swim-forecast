import assert from "node:assert/strict";
import { conditionScore, scoreBreakdown, tidePenalty, windExposure } from "../src/scoring.js";

const baseHour = {
  waveHeight: 0.3,
  swellHeight: 0.2,
  windSpeed: 10,
  gusts: 18,
  rainRisk: 10,
  waterTemp: 13,
  tideFullness: 0.8,
  tideTrend: "rising",
  weatherCode: 2,
  windDirection: 220,
};

assert.equal(conditionScore({ ...baseHour, waveHeight: 1.6 }), 0);
assert.equal(conditionScore({ ...baseHour, gusts: 41 }), 0);
assert.equal(windExposure(45).multiplier > windExposure(220).multiplier, true);
assert.equal(tidePenalty({ ...baseHour, tideFullness: 0.9 }, { thresholds: { preferred_tide: "Low tide" } }) > 8, true);

const calm = conditionScore({ ...baseHour });
const mixed = conditionScore({
  ...baseHour,
  waveHeight: 0.55,
  windSpeed: 18,
  gusts: 28,
  rainRisk: 45,
  windDirection: 60,
});
const rough = conditionScore({
  ...baseHour,
  waveHeight: 0.9,
  swellHeight: 0.55,
  windSpeed: 27,
  gusts: 36,
  rainRisk: 70,
  windDirection: 45,
});

assert.equal(calm > 80, true);
assert.equal(mixed < calm, true);
assert.equal(rough < mixed, true);
assert.equal(rough < 45, true);
assert.equal(scoreBreakdown({ ...baseHour, waveHeight: 0.9 }).reason, "waves look choppy");

console.log("scoring tests passed");
