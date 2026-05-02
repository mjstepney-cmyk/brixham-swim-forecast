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

function asItems(data) {
  const raw = data?.result?.items || data?.items || [];
  return Array.isArray(raw) ? raw : [];
}

function readDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function itemText(item) {
  return JSON.stringify(item || {}).toLowerCase();
}

function itemDate(item) {
  return (
    readDate(item?.predictedAt) ||
    readDate(item?.sampleDateTime) ||
    readDate(item?.samplingDateTime) ||
    readDate(item?.date) ||
    readDate(item?.created)
  );
}

function hasWarningLanguage(item) {
  const text = itemText(item);
  return (
    text.includes("advice against bathing") ||
    text.includes("pollution risk") ||
    text.includes("short term pollution") ||
    text.includes("abnormal situation")
  );
}

function isCurrentWarning(item, today) {
  const text = itemText(item);
  if (!hasWarningLanguage(item)) return false;
  return text.includes(today) || !itemDate(item);
}

export function parseQualityStatus(data) {
  const items = asItems(data);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentRisk = items.find((item) => isCurrentWarning(item, today));
  const latest = items
    .map((item) => ({ item, date: itemDate(item) }))
    .filter((entry) => entry.date)
    .sort((a, b) => b.date - a.date)[0];

  if (currentRisk) {
    return {
      state: "blocked",
      label: "EA pollution warning found",
      detail: "The Environment Agency feed appears to include a current short-term pollution warning for Breakwater Beach / Shoalstone.",
      checkedAt: latest?.date || now,
    };
  }

  return {
    state: "clear",
    label: "No current EA warning found",
    detail: "The Environment Agency feed did not return a current short-term pollution warning for Breakwater Beach / Shoalstone.",
    checkedAt: latest?.date || now,
  };
}
