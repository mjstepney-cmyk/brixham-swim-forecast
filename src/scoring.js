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

function rainRiskFromWeather(probability, precipitation, weatherCode) {
  if (Number.isFinite(probability)) return probability;
  if (Number.isFinite(precipitation)) {
    if (precipitation >= 2) return 85;
    if (precipitation >= 1) return 70;
    if (precipitation > 0) return 45;
  }
  if (weatherCode >= 80) return 60;
  if (weatherCode >= 61 && weatherCode <= 65) return 55;
  if (weatherCode >= 51 && weatherCode <= 55) return 40;
  return 10;
}

export function combineHours(weather, marine, preferences) {
  const hours = weather.hourly.time.map((time, index) => {
    const marineIndex = nearestIndex(marine.hourly.time, new Date(time));
    const precipitation = weather.hourly.precipitation?.[index] ?? 0;
    const weatherCode = weather.hourly.weather_code[index];
    return {
      time,
      temp: weather.hourly.temperature_2m[index],
      feels: weather.hourly.apparent_temperature[index],
      rainRisk: rainRiskFromWeather(weather.hourly.precipitation_probability?.[index], precipitation, weatherCode),
      windSpeed: weather.hourly.wind_speed_10m[index],
      gusts: weather.hourly.wind_gusts_10m[index],
      windDirection: weather.hourly.wind_direction_10m[index],
      weatherCode,
      precipitation,
      uv: weather.hourly.uv_index?.[index],
      waveHeight: marine.hourly.wave_height[marineIndex],
      waveDirection: marine.hourly.wave_direction[marineIndex],
      wavePeriod: marine.hourly.wave_period[marineIndex],
      windWaveHeight: marine.hourly.wind_wave_height?.[marineIndex],
      windWaveDirection: marine.hourly.wind_wave_direction?.[marineIndex],
      windWavePeriod: marine.hourly.wind_wave_period?.[marineIndex],
      swellHeight: marine.hourly.swell_wave_height[marineIndex],
      swellDirection: marine.hourly.swell_wave_direction?.[marineIndex],
      swellPeriod: marine.hourly.swell_wave_period?.[marineIndex],
      secondarySwellHeight: marine.hourly.secondary_swell_wave_height?.[marineIndex],
      secondarySwellDirection: marine.hourly.secondary_swell_wave_direction?.[marineIndex],
      secondarySwellPeriod: marine.hourly.secondary_swell_wave_period?.[marineIndex],
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
    hour.qualityWarning = true;
  });
}

function windowRank(hour) {
  return hour.score + (Number.isFinite(hour.tideFullness) ? hour.tideFullness * 4 : 0);
}

function windowReason(window) {
  const reasons = [];
  if (window.best.waveHeight <= 0.45) reasons.push("lower waves");
  if (window.best.windSpeed <= 16) reasons.push("lighter wind");
  if (window.best.rainRisk <= 35) reasons.push("lower rain risk");
  if (Math.abs(window.best.minutesToHighTide || 999) <= 90) reasons.push("near high tide");
  return reasons.slice(0, 2).join(", ") || scoreAdvice(window.best.score, window.best);
}

export function daylightWindows(hours) {
  const earliestStart = Date.now() + 2 * 60 * 60 * 1000;
  const horizon = Date.now() + 48 * 60 * 60 * 1000;
  const candidates = hours.filter((hour) => {
    const date = new Date(hour.time);
    const localHour = date.getHours();
    return date.getTime() >= earliestStart && date.getTime() <= horizon && localHour >= 6 && localHour <= 21 && hour.score >= 70;
  });
  const windows = [];
  let current = null;

  candidates.forEach((hour) => {
    const hourTime = new Date(hour.time).getTime();
    const previousTime = current ? new Date(current.end.time).getTime() : null;
    const isLong = current && current.hours.length >= 4;
    const conditionShift =
      current &&
      (Math.abs(hour.score - current.end.score) > 10 ||
        Math.abs(hour.waveHeight - current.end.waveHeight) > 0.2 ||
        Math.abs(hour.windSpeed - current.end.windSpeed) > 8 ||
        Math.abs(hour.rainRisk - current.end.rainRisk) > 25);
    if (!current || hourTime - previousTime > 75 * 60 * 1000 || isLong || conditionShift) {
      current = { start: hour, end: hour, hours: [hour], best: hour };
      windows.push(current);
    } else {
      current.end = hour;
      current.hours.push(hour);
      if (windowRank(hour) > windowRank(current.best)) current.best = hour;
    }
  });

  return windows
    .map((window) => ({
      ...window,
      averageScore: Math.round(window.hours.reduce((sum, hour) => sum + hour.score, 0) / window.hours.length),
      reason: windowReason(window),
    }))
    .filter((window) => window.hours.length >= 2 || window.best.score >= 82)
    .sort((a, b) => windowRank(b.best) - windowRank(a.best))
    .slice(0, 5)
    .sort((a, b) => new Date(a.start.time) - new Date(b.start.time));
}

function tideEvents(bucket) {
  const events = [];
  bucket.forEach((hour, index) => {
    const previous = bucket[index - 1]?.seaLevel;
    const next = bucket[index + 1]?.seaLevel;
    if (!Number.isFinite(hour.seaLevel) || !Number.isFinite(previous) || !Number.isFinite(next)) return;
    if (hour.seaLevel >= previous && hour.seaLevel > next) events.push({ type: "High", time: hour.time });
    if (hour.seaLevel <= previous && hour.seaLevel < next) events.push({ type: "Low", time: hour.time });
  });
  return events;
}

function periodSummary(bucket) {
  const usable = bucket.length ? bucket : [];
  const best = [...usable].sort((a, b) => windowRank(b) - windowRank(a))[0] || usable[0];
  const weatherCounts = new Map();
  usable.forEach((hour) => {
    weatherCounts.set(hour.weatherCode, (weatherCounts.get(hour.weatherCode) || 0) + 1);
  });
  const weatherCode = [...weatherCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? best?.weatherCode;
  return {
    best,
    score: best?.score ?? 0,
    weatherCode,
    windDirection: best?.windDirection,
    averageWind: usable.reduce((sum, hour) => sum + (hour.windSpeed || 0), 0) / (usable.length || 1),
    maxWind: Math.max(...usable.map((hour) => hour.windSpeed || 0)),
    maxWave: Math.max(...usable.map((hour) => hour.waveHeight || 0)),
    rainRisk: Math.max(...usable.map((hour) => hour.rainRisk || 0)),
  };
}

function bestDayWindows(bucket) {
  const windows = [];
  let current = null;
  bucket
    .filter((hour) => {
      const localHour = new Date(hour.time).getHours();
      return localHour >= 6 && localHour <= 21 && hour.score >= 68;
    })
    .forEach((hour) => {
      const hourTime = new Date(hour.time).getTime();
      const previousTime = current ? new Date(current.end.time).getTime() : null;
      if (!current || hourTime - previousTime > 75 * 60 * 1000 || current.hours.length >= 4) {
        current = { start: hour, end: hour, hours: [hour], best: hour };
        windows.push(current);
      } else {
        current.end = hour;
        current.hours.push(hour);
        if (windowRank(hour) > windowRank(current.best)) current.best = hour;
      }
    });
  return windows
    .map((window) => ({
      ...window,
      averageScore: Math.round(window.hours.reduce((sum, hour) => sum + hour.score, 0) / window.hours.length),
      reason: windowReason(window),
    }))
    .sort((a, b) => windowRank(b.best) - windowRank(a.best))
    .slice(0, 3);
}

export function groupByDay(hours) {
  const days = new Map();
  hours.forEach((hour) => {
    const key = hour.time.slice(0, 10);
    const bucket = days.get(key) || [];
    bucket.push(hour);
    days.set(key, bucket);
  });
  return [...days.entries()].slice(0, 7).map(([date, bucket]) => {
    const daylight = bucket.filter((hour) => {
      const localHour = new Date(hour.time).getHours();
      return localHour >= 6 && localHour <= 21;
    });
    const best = [...daylight].sort((a, b) => windowRank(b) - windowRank(a))[0] || bucket[0];
    const morning = bucket.filter((hour) => {
      const localHour = new Date(hour.time).getHours();
      return localHour >= 6 && localHour < 12;
    });
    const afternoon = bucket.filter((hour) => {
      const localHour = new Date(hour.time).getHours();
      return localHour >= 12 && localHour <= 21;
    });
    return {
      date,
      best,
      morning: periodSummary(morning),
      afternoon: periodSummary(afternoon),
      tideEvents: tideEvents(bucket),
      windows: bestDayWindows(bucket),
    };
  });
}
