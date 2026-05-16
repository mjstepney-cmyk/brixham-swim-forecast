import { cardinal, clamp, fmt, nearestIndex, $ } from "./utils.js";
import { daylightWindows, groupByDay, scoreAdvice, scoreClass, scoreLabel } from "./scoring.js";

let forecastHours = [];
let currentSnapshot = null;

export function setForecastHours(hours) {
  forecastHours = hours;
}

function weatherText(code) {
  const map = {
    0: "Clear",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    80: "Showers",
    81: "Showers",
    82: "Heavy showers",
    95: "Thunder",
  };
  return map[code] || "Mixed weather";
}

function weatherIcon(code) {
  if (code === 0) return "weather-sun";
  if ([1, 2].includes(code)) return "weather-part";
  if ([3, 45, 48].includes(code)) return "weather-cloud";
  if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) return "weather-rain";
  if (code >= 95) return "weather-storm";
  return "weather-mix";
}

function waveClass(height) {
  if (!Number.isFinite(height)) return "wave-watch";
  if (height <= 0.45) return "wave-ok";
  if (height <= 0.8) return "wave-watch";
  return "wave-rough";
}

function tideSummary(hour) {
  if (!Number.isFinite(hour?.tideFullness)) return "--";
  const percent = Math.round(hour.tideFullness * 100);
  if (percent >= 85) return "High";
  if (percent >= 60) return "Mid-high";
  if (percent >= 35) return "Mid";
  if (percent >= 15) return "Mid-low";
  return "Low";
}

function timeText(time) {
  return new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function dateText(time) {
  return new Date(time).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function periodDiffers(day) {
  if (!day.morning?.best || !day.afternoon?.best) return false;
  return (
    Math.abs(day.morning.maxWave - day.afternoon.maxWave) >= 0.25 ||
    Math.abs(day.morning.maxWind - day.afternoon.maxWind) >= 8 ||
    Math.abs(day.morning.rainRisk - day.afternoon.rainRisk) >= 35 ||
    day.morning.weatherCode !== day.afternoon.weatherCode
  );
}

function periodLine(label, period) {
  if (!period?.best) return "";
  return `
    <span class="period-card">
      <strong>${label}</strong>
      <em>${cardinal(period.windDirection)} ${fmt(period.averageWind, " km/h")}</em>
      <small>${weatherText(period.weatherCode)} · waves to ${fmt(period.maxWave, " m", 1)}</small>
    </span>
  `;
}

function tideEventText(events) {
  if (!events?.length) return "Tide times unavailable";
  return events
    .slice(0, 4)
    .map((event) => `${event.type} ${timeText(event.time)}`)
    .join(" · ");
}

function tideCurveEvents(hours) {
  const events = hours.find((hour) => hour.ukhoEvents?.length)?.ukhoEvents || [];
  const next = events.find((event) => new Date(event.time).getTime() >= Date.now());
  if (!next) return [];
  const end = new Date(next.time).getTime() + 48 * 60 * 60 * 1000;
  return events.filter((event) => {
    const time = new Date(event.time).getTime();
    return time >= new Date(next.time).getTime() && time <= end;
  });
}

function tideCurvePath(points) {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  let path = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  rest.forEach((point, index) => {
    const previous = points[index];
    const middle = (previous.x + point.x) / 2;
    path += ` C ${middle.toFixed(1)} ${previous.y.toFixed(1)}, ${middle.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  });
  return path;
}

function tideLabelDay(time) {
  return new Date(time).toLocaleDateString("en-GB", { weekday: "short" });
}

function tideBlock(events) {
  return `
    <div class="tide-times tide-times-top">
      <small>Tides</small>
      <span>${tideEventText(events)}</span>
    </div>
  `;
}

function marineDetailText(hour) {
  const parts = [];
  if (Number.isFinite(hour.swellHeight)) {
    parts.push(`swell ${fmt(hour.swellHeight, " m", 1)}${Number.isFinite(hour.swellPeriod) ? ` / ${fmt(hour.swellPeriod, "s")}` : ""}`);
  }
  if (Number.isFinite(hour.windWaveHeight)) {
    parts.push(`wind wave ${fmt(hour.windWaveHeight, " m", 1)}`);
  }
  return parts.length ? parts.join(", ") : `${fmt(hour.waveHeight, " m", 1)} waves`;
}

function dayDetail(day) {
  if (!day.windows?.length) {
    return `
      <div class="day-detail">
        <strong>No standout swim period from the model</strong>
        <span>The daily conditions may still be usable locally; the model did not find a stronger daylight block.</span>
      </div>
    `;
  }
  return `
    <div class="day-detail">
      <strong>Best detail</strong>
      ${day.windows
        .map(
          (window) => `
            <span>${timeText(window.start.time)}-${timeText(new Date(new Date(window.end.time).getTime() + 60 * 60 * 1000))}: ${window.reason}; ${fmt(window.best.waveHeight, " m", 1)} waves, ${cardinal(window.best.windDirection)} ${fmt(window.best.windSpeed, " km/h")} wind, ${fmt(window.best.rainRisk, "%")} rain risk</span>
            <span class="marine-detail">${marineDetailText(window.best)}</span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderVisualTideReadout(hour) {
  $("visualTide").textContent = tideSummary(hour);
}

function setVisualMode(mode, hour = null) {
  const isFuture = mode === "future" && hour;
  $("visualTitle").textContent = isFuture ? "Forecast conditions" : "Current conditions";
  $("visualSubtitle").textContent = isFuture
    ? new Date(hour.time).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })
    : "Breakwater Beach now";
  $("visualReturnButton").hidden = !isFuture;
}

function renderMurkinessNotice(hour) {
  const notice = $("murkyNotice");
  if (!notice) return;
  notice.hidden = !hour?.murkinessRisk;
}

export function setRefreshState(state) {
  const button = $("refreshButton");
  if (!button) return;
  button.disabled = state === "refreshing";
  button.textContent = state === "refreshing" ? "Refreshing..." : "Refresh";
}

export function renderQuality(quality) {
  const card = $("waterQualityCard");
  if (!card) return;
  const checked = quality.checkedAt
    ? new Date(quality.checkedAt).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })
    : "just now";
  card.className = `notice quality-card ${quality.state}`;
  card.innerHTML = `
    <h2>Water quality</h2>
    <p><strong>${quality.label}</strong></p>
    <p>${quality.detail}</p>
    <p class="quality-meta">EA feed checked ${checked}. Check EA Swimfo for weekly sample results and WaterFit for recent overflow risk.</p>
    <p>
      <a class="text-link" href="https://www.southwestwater.co.uk/breakwater-shoalstone" target="_blank" rel="noopener">Open WaterFit Live</a>
      <a class="text-link quality-link" href="https://environment.data.gov.uk/bwq/profiles/profile.html?_search=Shoal&site=ukk4200-24500" target="_blank" rel="noopener">Open EA Swimfo results</a>
    </p>
  `;
}

function renderBeachVisual(nowWeather, nowMarine, hours, current) {
  const scene = $("beachScene");
  const nextTwoDays = hours.slice(0, 48).filter((hour) => Number.isFinite(hour.seaLevel));
  const tideValues = nextTwoDays.map((hour) => hour.seaLevel);
  const minTide = tideValues.length ? Math.min(...tideValues) : -1;
  const maxTide = tideValues.length ? Math.max(...tideValues) : 1;
  const tideRange = maxTide - minTide || 1;
  const tidePercent = clamp(((nowMarine.sea_level_height_msl - minTide) / tideRange) * 100, 8, 96);
  const waveLevel = clamp((nowMarine.wave_height / 1.4) * 34, 6, 34);
  const windDirection = Number.isFinite(nowWeather.wind_direction_10m) ? nowWeather.wind_direction_10m : 0;

  scene.style.setProperty("--wind-rotation", `${windDirection + 180}deg`);
  scene.style.setProperty("--wave-level", `${waveLevel}px`);
  scene.style.setProperty("--tide-level", `${tidePercent}%`);

  $("visualWind").textContent = `${cardinal(nowWeather.wind_direction_10m)} ${fmt(nowWeather.wind_speed_10m, " km/h")}`;
  $("visualWave").textContent = fmt(nowMarine.wave_height, " m", 1);
  $("waveStatus").className = `wave-status ${waveClass(nowMarine.wave_height)}`;
  renderVisualTideReadout(current);
  renderMurkinessNotice(current);
  $("visualTemp").textContent = fmt(nowMarine.sea_surface_temperature, " deg C", 1);
  $("visualAirTemp").textContent = fmt(nowWeather.temperature_2m, " deg C", 1);
  $("visualWeatherIcon").className = `weather-symbol ${weatherIcon(nowWeather.weather_code)}`;
  $("visualWeather").textContent = weatherText(nowWeather.weather_code);
  $("visualRain").textContent = fmt(current.rainRisk, "%");
  $("visualFeels").textContent = fmt(nowWeather.apparent_temperature, " deg C", 1);
}

function weatherFromHour(hour) {
  return {
    temperature_2m: hour.temp,
    apparent_temperature: hour.feels,
    wind_speed_10m: hour.windSpeed,
    wind_direction_10m: hour.windDirection,
    wind_gusts_10m: hour.gusts,
    weather_code: hour.weatherCode,
  };
}

function marineFromHour(hour) {
  return {
    wave_height: hour.waveHeight,
    wave_direction: hour.waveDirection,
    wave_period: hour.wavePeriod,
    swell_wave_height: hour.swellHeight,
    sea_surface_temperature: hour.waterTemp,
    sea_level_height_msl: hour.seaLevel,
    ocean_current_velocity: hour.current,
  };
}

function selectForecastHour(time) {
  const selected = forecastHours.find((hour) => hour.time === time);
  if (!selected) return;
  const date = new Date(selected.time);
  document.querySelectorAll("[data-forecast-time]").forEach((card) => {
    card.classList.toggle("selected", card.dataset.forecastTime === time);
  });
  $("scoreBadge").className = `score-badge scene-score ${scoreClass(selected.score)}`;
  $("scoreBadge").querySelector("span").textContent = selected.score;
  $("summaryCard").innerHTML = `
    <p class="status-label">${scoreLabel(selected.score)}</p>
    <h2>${date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. ${scoreAdvice(selected.score, selected)}.</h2>
    <p class="muted">Forecast selection shown in the beach panel.</p>
    <button id="returnCurrentButton" class="text-button" type="button">Return to current</button>
  `;
  renderBeachVisual(weatherFromHour(selected), marineFromHour(selected), forecastHours, selected);
  setVisualMode("future", selected);
  $("returnCurrentButton").addEventListener("click", () => {
    if (currentSnapshot) renderCurrent(currentSnapshot.weather, currentSnapshot.marine, currentSnapshot.hours, currentSnapshot.meta);
  });
}

export function renderCurrent(weather, marine, hours, meta = {}) {
  currentSnapshot = { weather, marine, hours, meta };
  const nowWeather = weather.current;
  const nowMarine = marine.current;
  const current = hours[nearestIndex(hours.map((hour) => hour.time))];
  const score = current.score;

  $("scoreBadge").className = `score-badge scene-score ${scoreClass(score)}`;
  $("scoreBadge").querySelector("span").textContent = score;
  $("summaryCard").innerHTML = `
    <p class="status-label">${scoreLabel(score)}</p>
    <h2>${weatherText(nowWeather.weather_code)} now. ${scoreAdvice(score, current)}.</h2>
  `;
  const cachedAt = meta.cachedAt ? new Date(meta.cachedAt) : null;
  $("lastUpdated").textContent = `${cachedAt ? "Cached" : "Updated"} ${new Date(cachedAt || Date.now()).toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  renderBeachVisual(nowWeather, nowMarine, hours, current);
  setVisualMode("current");
  document.querySelectorAll("[data-forecast-time]").forEach((card) => {
    card.classList.remove("selected");
  });
}

export function renderWeatherOnly(weather, meta = {}) {
  const nowWeather = weather.current;
  const cachedAt = meta.cachedAt ? new Date(meta.cachedAt) : null;

  $("scoreBadge").className = "score-badge scene-score watch";
  $("scoreBadge").querySelector("span").textContent = "--";
  $("summaryCard").innerHTML = `
    <p class="status-label">Partial forecast</p>
    <h2>${weatherText(nowWeather.weather_code)} now. Marine data is unavailable, so swim score, waves and tide are paused.</h2>
    <p class="muted">Air temperature, wind and rain risk are still shown. Check the webcam, local signs and official sources before swimming.</p>
  `;
  $("lastUpdated").textContent = `${cachedAt ? "Cached" : "Updated"} ${new Date(cachedAt || Date.now()).toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  $("visualAirTemp").textContent = fmt(nowWeather.temperature_2m, " deg C", 1);
  $("visualWind").textContent = `${cardinal(nowWeather.wind_direction_10m)} ${fmt(nowWeather.wind_speed_10m, " km/h")}`;
  $("visualWeatherIcon").className = `weather-symbol ${weatherIcon(nowWeather.weather_code)}`;
  $("visualWeather").textContent = weatherText(nowWeather.weather_code);
  $("visualRain").textContent = "--";
  $("visualFeels").textContent = fmt(nowWeather.apparent_temperature, " deg C", 1);
  $("visualWave").textContent = "--";
  $("visualTide").textContent = "--";
  $("murkyNotice").hidden = true;
  setVisualMode("current");
  $("visualTemp").textContent = "--";
  $("windowsList").innerHTML = `<article class="window"><div><strong>Swim windows paused</strong><small>Marine wave and tide data is needed before ranking swim windows.</small></div><span class="pill watch">--</span></article>`;
  $("dailyList").innerHTML = `<article class="day"><div><strong>Outlook paused</strong><small>Weather is available, but marine data is needed for safe swim scoring.</small></div><span class="pill watch">--</span></article>`;
}

export function renderWindows(hours) {
  const windows = daylightWindows(hours);
  $("windowsList").innerHTML = windows.length
    ? windows
        .map((window) => {
          const tidePercent = Number.isFinite(window.best.tideFullness) ? Math.round(window.best.tideFullness * 100) : null;
          return `
            <article class="window forecast-card" tabindex="0" role="button" data-forecast-time="${window.best.time}">
              <div>
                <strong>${dateText(window.start.time)}, ${timeText(window.start.time)}-${timeText(new Date(new Date(window.end.time).getTime() + 60 * 60 * 1000))}</strong>
            <small>${window.reason}; ${fmt(window.best.waveHeight, " m", 1)} waves, ${fmt(window.best.windSpeed, " km/h")} wind, ${fmt(window.best.rainRisk, "%")} rain risk</small>
                <span class="tide-chip">${tidePercent ?? "--"}% high tide - ${window.best.highTideLabel}</span>
              </div>
              <span class="pill ${scoreClass(window.averageScore)}">${window.averageScore}</span>
            </article>
          `;
        })
        .join("")
    : `<article class="window"><div><strong>No clear grouped windows in the next 48 hours</strong><small>Conditions may still be usable locally; the model did not find a stronger daylight period.</small></div><span class="pill watch">--</span></article>`;
}

export function renderTideCurve(hours) {
  const container = $("tideCurve");
  if (!container) return;
  const events = tideCurveEvents(hours).slice(0, 5);
  if (events.length < 2) {
    container.innerHTML = `<article class="tide-curve-card"><strong>Tide curve unavailable</strong><small>UKHO tide events are needed for the forward curve.</small></article>`;
    return;
  }

  const width = 640;
  const height = 238;
  const paddingX = 38;
  const paddingY = 26;
  const chartBottom = 132;
  const labelTop = 158;
  const start = new Date(events[0].time).getTime();
  const end = new Date(events[events.length - 1].time).getTime();
  const points = events.map((event) => {
    const time = new Date(event.time).getTime();
    const x = paddingX + ((time - start) / (end - start)) * (width - paddingX * 2);
    const y = event.type === "High" ? paddingY : chartBottom;
    return { ...event, x, y };
  });

  container.innerHTML = `
    <article class="tide-curve-card">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="UKHO tide curve for the next 48 hours">
        ${points
          .map(
            (point) => `
              <line class="tide-guide" x1="${point.x.toFixed(1)}" y1="${point.y.toFixed(1)}" x2="${point.x.toFixed(
                1
              )}" y2="${labelTop - 8}" />
            `
          )
          .join("")}
        <path class="tide-curve-line" d="${tideCurvePath(points)}" />
        ${points
          .map(
            (point) => `
              <g class="tide-point">
                <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5" />
              </g>
            `
          )
          .join("")}
        ${points
          .map(
            (point) => `
              <g class="tide-label" transform="translate(${point.x.toFixed(1)} ${labelTop})">
                <rect x="-40" y="0" width="80" height="58" rx="8" />
                <text class="tide-label-type" x="0" y="17" text-anchor="middle">${point.type}</text>
                <text class="tide-label-day" x="0" y="34" text-anchor="middle">${tideLabelDay(point.time)}</text>
                <text class="tide-label-time" x="0" y="52" text-anchor="middle">${timeText(point.time)}</text>
              </g>
            `
          )
          .join("")}
      </svg>
      <small>First tide turns from ${dateText(events[0].time)}.</small>
    </article>
  `;
}

export function renderDaily(hours) {
  $("dailyList").innerHTML = groupByDay(hours)
    .map((day) => {
      const date = new Date(`${day.date}T12:00:00`);
      const split = periodDiffers(day);
      return `
        <article class="day forecast-card day-card" tabindex="0" role="button" data-forecast-time="${day.best.time}">
          <div>
            <strong>${date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</strong>
            ${tideBlock(day.tideEvents)}
            <div class="day-main">
              <div class="day-periods">
                ${split ? periodLine("AM", day.morning) + periodLine("PM", day.afternoon) : periodLine("Day", day.morning.best ? day.morning : day.afternoon)}
              </div>
            </div>
            <button class="details-button" type="button" aria-expanded="false">Details</button>
            ${dayDetail(day)}
          </div>
        </article>
      `;
    })
    .join("");
}

export function bindForecastCards() {
  const visualReturnButton = $("visualReturnButton");
  if (visualReturnButton) visualReturnButton.onclick = () => {
    if (currentSnapshot) renderCurrent(currentSnapshot.weather, currentSnapshot.marine, currentSnapshot.hours, currentSnapshot.meta);
  };

  document.querySelectorAll("[data-forecast-time]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest(".details-button")) {
        const expanded = card.classList.toggle("expanded");
        event.target.setAttribute("aria-expanded", String(expanded));
        return;
      }
      selectForecastHour(card.dataset.forecastTime);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectForecastHour(card.dataset.forecastTime);
      }
    });
  });
}

export function renderError(error) {
  $("summaryCard").innerHTML = `
    <p class="status-label">Forecast unavailable</p>
    <h2>The live forecast could not be loaded.</h2>
    <p class="muted">${error.message}. Try again when you have a connection.</p>
  `;
}
