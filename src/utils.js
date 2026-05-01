export const $ = (id) => document.getElementById(id);

export function nearestIndex(times, target = new Date()) {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  times.forEach((time, index) => {
    const distance = Math.abs(new Date(time).getTime() - target.getTime());
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

export function cardinal(degrees) {
  if (!Number.isFinite(degrees)) return "--";
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return labels[Math.round(degrees / 45) % 8];
}

export function fmt(value, unit = "", digits = 0) {
  if (!Number.isFinite(value)) return "--";
  return `${value.toFixed(digits)}${unit}`;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
