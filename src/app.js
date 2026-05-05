import { CACHE_TTL_MS, marineUrl, qualityUrl, tidesUrl, weatherUrl } from "./config.js";
import { fetchJsonWithCache, parseQualityStatus } from "./data.js";
import { readStoredPreferences } from "./preferences.js";
import { applyQualityStatus, combineHours } from "./scoring.js";
import {
  bindForecastCards,
  renderCurrent,
  renderDaily,
  renderError,
  renderQuality,
  setRefreshState,
  renderTideCurve,
  renderWeatherOnly,
  renderWindows,
  setForecastHours,
} from "./render.js";

let refreshInFlight = null;
let lastRefreshStartedAt = 0;

async function boot(options = {}) {
  try {
    setRefreshState("refreshing");
    lastRefreshStartedAt = Date.now();
    const preferences = readStoredPreferences();
    const [weatherResult, marineResult, qualityResult, tidesResult] = await Promise.allSettled([
      fetchJsonWithCache(weatherUrl, "weather", options),
      fetchJsonWithCache(marineUrl, "marine", options),
      fetchJsonWithCache(qualityUrl, "quality", options),
      fetchJsonWithCache(tidesUrl, "tides", options),
    ]);

    if (weatherResult.status === "rejected") {
      throw new Error("Weather data could not be loaded");
    }

    const weather = weatherResult.value.data;
    const quality =
      qualityResult.status === "fulfilled"
        ? parseQualityStatus(qualityResult.value.data)
        : {
            state: "unknown",
            label: "EA check unavailable",
            detail: "The Environment Agency water-quality check could not be loaded. Use SAS, Swimfo or local beach signs before swimming.",
          };

    if (marineResult.status === "rejected") {
      renderQuality(quality);
      renderWeatherOnly(weather, {
        cachedAt: weatherResult.value.cachedAt,
        marineError: marineResult.reason,
      });
      return;
    }

    const marine = marineResult.value.data;
    const tides = tidesResult.status === "fulfilled" ? tidesResult.value.data : null;
    const hours = combineHours(weather, marine, preferences, tides);
    setForecastHours(hours);
    applyQualityStatus(hours, quality);
    renderQuality(quality);
    renderCurrent(weather, marine, hours, {
      cachedAt: weatherResult.value.cachedAt || marineResult.value.cachedAt,
    });
    renderTideCurve(hours);
    renderWindows(hours);
    renderDaily(hours);
    bindForecastCards();
    setRefreshState("idle");
  } catch (error) {
    renderError(error);
    setRefreshState("idle");
  }
}

function refreshForecast(options = {}) {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = boot(options).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

refreshForecast();

document.getElementById("refreshButton")?.addEventListener("click", () => {
  refreshForecast({ forceRefresh: true });
});

setInterval(() => {
  refreshForecast({ forceRefresh: true });
}, CACHE_TTL_MS);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastRefreshStartedAt >= CACHE_TTL_MS) {
    refreshForecast({ forceRefresh: true });
  }
});

window.addEventListener("focus", () => {
  if (Date.now() - lastRefreshStartedAt >= CACHE_TTL_MS) {
    refreshForecast({ forceRefresh: true });
  }
});
