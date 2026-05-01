import { DEFAULT_PREFERENCES } from "./config.js";
import { clamp, nearestIndex } from "./utils.js";

export const SCORE_RULES = {
  killSwitches: {
    waveHeight: { limit: 1.5, reason: "wave height over 1.5 m" },
    gusts: { limit: 40, reason: "gusts over 40 km/h" },
  },
  wave: { comfort: 0.35, penaltyPerMetre: 85, rough: 0.65 },
  swell: { comfort: 0.25, penaltyPerMetre: 55 },
  wind: { comfort: 13, penaltyPerKmh: 2.2 },
  gusts: { comfort: 22, penaltyPerKmh: 1.5 },
  rain: { comfort: 35, penaltyPerPercent: 0.35, elevated: 50 },
  waterTemp: { comfort: 10, penaltyPerDegree: 3.5, cold: 11 },
  weather: { showersPenalty: 8 },
  tide: { defaultPenalty: 10, midPenaltyScale: 14, fallingMidTidePenalty: 4 },
};

export function windExposure(degrees) {
  if (!Number.isFinite(degrees)) return { label: "unknown wind exposure", multiplier: 1 };
  const normalised = (degrees + 360) % 360;
  if (normalised >= 315 || normalised <= 135) return { label: "exposed N/E wind", multiplier: 1.35 };
  if (normalised >= 160 && normalised <= 260) return { label: "sheltered S/W wind", multiplier: 0.75 };
  return { label: "cross-shore wind", multiplier: 1 };
}

export function tidePenalty(hour, preferences) {
  if (!Number.isFinite(hour.tideFullness)) return 0;
  const preferred = preferences?.thresholds?.preferred_tide || DEFAULT_PREFERENCES.thresholds.preferred_tide;
  if (preferred === "Any safe tide") return 0;
  if (preferred === "Mid tide rising") {
    const midPenalty = Math.abs(hour.tideFullness - 0.55) * SCORE_RULES.tide.midPenaltyScale;
    return hour.tideTrend === "falling" ? midPenalty + SCORE_RULES.tide.fallingMidTidePenalty : midPenalty;
  }
  if (preferred === "Low tide") return hour.tideFullness * SCORE_RULES.tide.defaultPenalty;
  return (1 - hour.tideFullness) * SCORE_RULES.tide.defaultPenalty;
}

function penalty(amount, reason, penalties) {
  if (amount <= 0) return 0;
  penalties.push({ amount, reason });
  return amount;
}

export function scoreBreakdown(hour, preferences = DEFAULT_PREFERENCES) {
  const rules = SCORE_RULES;
  if (hour.waveHeight > rules.killSwitches.waveHeight.limit) {
    return { score: 0, reason: rules.killSwitches.waveHeight.reason, penalties: [] };
  }
  if (hour.gusts > rules.killSwitches.gusts.limit) {
    return { score: 0, reason: rules.killSwitches.gusts.reason, penalties: [] };
  }

  const penalties = [];
  const exposure = windExposure(hour.windDirection);
  let score = 100;
  score -= penalty(Math.max(0, hour.waveHeight - rules.wave.comfort) * rules.wave.penaltyPerMetre, "waves look choppy", penalties);
  score -= penalty(Math.max(0, hour.swellHeight - rules.swell.comfort) * rules.swell.penaltyPerMetre, "swell is building", penalties);
  score -= penalty(Math.max(0, hour.windSpeed - rules.wind.comfort) * rules.wind.penaltyPerKmh * exposure.multiplier, exposure.label, penalties);
  score -= penalty(Math.max(0, hour.gusts - rules.gusts.comfort) * rules.gusts.penaltyPerKmh * exposure.multiplier, "gusts are elevated", penalties);
  score -= penalty(Math.max(0, hour.rainRisk - rules.rain.comfort) * rules.rain.penaltyPerPercent, "rain risk is elevated", penalties);
  score -= penalty(Math.max(0, rules.waterTemp.comfort - hour.waterTemp) * rules.waterTemp.penaltyPerDegree, "cold water needs proper kit", penalties);
  score -= penalty(tidePenalty(hour, preferences), "less preferred tide state", penalties);
  score -= penalty(hour.weatherCode >= 80 ? rules.weather.showersPenalty : 0, "showery weather", penalties);

  penalties.sort((a, b) => b.amount - a.amount);
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reason: penalties[0]?.reason || null,
    penalties,
    windExposure: exposure.label,
  };
}

export function conditionScore(hour, preferences = DEFAULT_PREFERENCES) {
  const breakdown = scoreBreakdown(hour, preferences);
  hour.windExposure = breakdown.windExposure;
  hour.scoreReason = breakdown.score < 55 ? breakdown.reason : null;
  return breakdown.score;
}

export function scoreClass(score) {
  if (score >= 72) return "ok";
  if (score >= 48) return "watch";
  return "rough";
}

export function scoreLabel(score) {
  if (score >= 78) return "Good swim window";
  if (score >= 62) return "Worth considering";
  if (score >= 45) return "Mixed conditions";
  return "Better to wait";
}

export function scoreAdvice(score, hour) {
  const bits = [];
  if (hour.scoreReason) bits.push(hour.scoreReason);
  if (hour.waveHeight <= 0.35) bits.push("low wave height");
  if (hour.windSpeed <= 13) bits.push("lighter wind");
  if (hour.rainRisk >= SCORE_RULES.rain.elevated) bits.push("rain risk is elevated");
  if (hour.waveHeight > SCORE_RULES.wave.rough) bits.push("waves look choppy");
  if (hour.waterTemp < SCORE_RULES.waterTemp.cold) bits.push("cold water needs proper kit");
  if (!bits.length) bits.push("conditions are balanced rather than exceptional");
  return bits.join(", ");
}

export function formatHighTideDelta(minutes) {
  if (!Number.isFinite(minutes)) return "High tide timing unavailable";
  const abs = Math.abs(minutes);
  if (abs < 30) return "Near high tide";
  const hours = Math.round(abs / 60);
  if (minutes > 0) return `${hours}h before high`;
  return `${hours}h after high`;
}

export function annotateTides(hours) {
  const tideValues = hours.map((hour) => hour.seaLevel).filter(Number.isFinite);
  const minTide = tideValues.length ? Math.min(...tideValues) : -1;
  const maxTide = tideValues.length ? Math.max(...tideValues) : 1;
  const tideRange = maxTide - minTide || 1;
  const highTides = [];

  hours.forEach((hour, index) => {
    const previous = hours[index - 1]?.seaLevel;
    const next = hours[index + 1]?.seaLevel;
    if (
      Number.isFinite(hour.seaLevel) &&
      Number.isFinite(previous) &&
      Number.isFinite(next) &&
      hour.seaLevel >= previous &&
      hour.seaLevel > next
    ) {
      highTides.push(hour);
    }
  });

  hours.forEach((hour, index) => {
    const previous = hours[index - 1]?.seaLevel;
    hour.tideFullness = Number.isFinite(hour.seaLevel) ? clamp((hour.seaLevel - minTide) / tideRange, 0, 1) : null;
    hour.tideTrend = Number.isFinite(previous) && Number.isFinite(hour.seaLevel) && hour.seaLevel >= previous ? "rising" : "falling";
    const time = new Date(hour.time).getTime();
    const nearestHigh = highTides
      .map((high) => ({
        high,
        minutes: Math.round((new Date(high.time).getTime() - time) / 60000),
      }))
      .sort((a, b) => Math.abs(a.minutes) - Math.abs(b.minutes))[0];

    hour.nearestHighTide = nearestHigh?.high || null;
    hour.minutesToHighTide = nearestHigh?.minutes ?? null;
    hour.highTideLabel = formatHighTideDelta(hour.minutesToHighTide);
  });

  return hours;
}

export function combineHours(weather, marine, preferences) {
  const hours = weather.hourly.time.map((time, index) => {
    const marineIndex = nearestIndex(marine.hourly.time, new Date(time));
    return {
      time,
      temp: weather.hourly.temperature_2m[index],
      feels: weather.hourly.apparent_temperature[index],
      rainRisk: weather.hourly.precipitation_probability[index],
      windSpeed: weather.hourly.wind_speed_10m[index],
      gusts: weather.hourly.wind_gusts_10m[index],
      windDirection: weather.hourly.wind_direction_10m[index],
      weatherCode: weather.hourly.weather_code[index],
      uv: weather.hourly.uv_index[index],
      waveHeight: marine.hourly.wave_height[marineIndex],
      waveDirection: marine.hourly.wave_direction[marineIndex],
      wavePeriod: marine.hourly.wave_period[marineIndex],
      swellHeight: marine.hourly.swell_wave_height[marineIndex],
      waterTemp: marine.hourly.sea_surface_temperature[marineIndex],
      seaLevel: marine.hourly.sea_level_height_msl[marineIndex],
      current: marine.hourly.ocean_current_velocity[marineIndex],
    };
  });
  annotateTides(hours);
  hours.forEach((hour) => {
    hour.score = conditionScore(hour, preferences);
  });
  return hours;
}

export function applyQualityStatus(hours, quality) {
  if (quality?.state !== "blocked") return;
  hours.forEach((hour) => {
    hour.score = 0;
    hour.scoreReason = "official water quality warning";
  });
}

export function daylightWindows(hours) {
  return hours
    .filter((hour) => {
      const date = new Date(hour.time);
      const localHour = date.getHours();
      return localHour >= 6 && localHour <= 21;
    })
    .sort((a, b) => b.score + b.tideFullness * 4 - (a.score + a.tideFullness * 4))
    .slice(0, 5)
    .sort((a, b) => new Date(a.time) - new Date(b.time));
}

export function groupByDay(hours) {
  const days = new Map();
  hours.forEach((hour) => {
    const key = hour.time.slice(0, 10);
    const bucket = days.get(key) || [];
    bucket.push(hour);
    days.set(key, bucket);
  });
  return [...days.entries()].map(([date, bucket]) => {
    const daylight = bucket.filter((hour) => {
      const localHour = new Date(hour.time).getHours();
      return localHour >= 6 && localHour <= 21;
    });
    const best = daylight.sort((a, b) => b.score + b.tideFullness * 4 - (a.score + a.tideFullness * 4))[0] || bucket[0];
    const maxWave = Math.max(...bucket.map((hour) => hour.waveHeight || 0));
    const maxWind = Math.max(...bucket.map((hour) => hour.windSpeed || 0));
    return { date, best, maxWave, maxWind };
  });
}
