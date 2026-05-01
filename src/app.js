import { marineUrl, qualityUrl, weatherUrl } from "./config.js";
import { fetchJsonWithCache, parseQualityStatus } from "./data.js";
import { readStoredPreferences } from "./preferences.js";
import { applyQualityStatus, combineHours } from "./scoring.js";
import {
  bindForecastCards,
  renderCurrent,
  renderDaily,
  renderError,
  renderQuality,
  renderWeatherOnly,
  renderWindows,
  setForecastHours,
} from "./render.js";

async function boot() {
  try {
    const preferences = readStoredPreferences();
    const [weatherResult, marineResult, qualityResult] = await Promise.allSettled([
      fetchJsonWithCache(weatherUrl, "weather"),
      fetchJsonWithCache(marineUrl, "marine"),
      fetchJsonWithCache(qualityUrl, "quality"),
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
    const hours = combineHours(weather, marine, preferences);
    setForecastHours(hours);
    applyQualityStatus(hours, quality);
    renderQuality(quality);
    renderCurrent(weather, marine, hours, {
      cachedAt: weatherResult.value.cachedAt || marineResult.value.cachedAt,
    });
    renderWindows(hours);
    renderDaily(hours);
    bindForecastCards();
  } catch (error) {
    renderError(error);
  }
}

boot();
