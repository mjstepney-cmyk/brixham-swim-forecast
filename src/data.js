import { CACHE_PREFIX, CACHE_TTL_MS } from "./config.js";

function readCache(key, allowStale = false) {
  try {
    const cached = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${key}`) || "null");
    if (!cached?.data || (!allowStale && Date.now() - cached.savedAt > CACHE_TTL_MS)) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Ignore storage failures; live data still works.
  }
}

export async function fetchJsonWithCache(url, key, options = {}) {
  const fresh = options.forceRefresh ? null : readCache(key);
  if (fresh) return { data: fresh.data, cachedAt: fresh.savedAt };

  try {
    const response = await fetch(url, { cache: options.forceRefresh ? "no-store" : "default" });
    if (!response.ok) throw new Error(`${key} service did not respond cleanly`);
    const data = await response.json();
    writeCache(key, data);
    return { data, cachedAt: null };
  } catch (error) {
    const stale = readCache(key, true);
    if (stale) return { data: stale.data, cachedAt: stale.savedAt, stale: true };
    throw error;
  }
}

export function parseQualityStatus(data) {
  const items = data?.result?.items || data?.items || [];
  const today = new Date().toISOString().slice(0, 10);
  const currentRisk = items.find((item) => JSON.stringify(item).includes(today));
  return currentRisk
    ? {
        state: "blocked",
        label: "Advice against bathing",
        detail: "Environment Agency data appears to include a current warning for Breakwater Beach (Shoalstone). Treat this as do not swim until checked locally.",
      }
    : {
        state: "clear",
        label: "No EA warning found",
        detail: "The Environment Agency check did not return a current short-term pollution warning for Breakwater Beach (Shoalstone). Still check local signs and water-quality sources before swimming.",
      };
}
