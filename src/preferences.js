import { DEFAULT_PREFERENCES, PREFERENCE_KEY } from "./config.js";

export function readStoredPreferences() {
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem(PREFERENCE_KEY) || "{}") };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}
