export const BEACH = {
  name: "Breakwater Beach",
  latitude: 50.3999,
  longitude: -3.5044,
  timezone: "Europe/London",
};

export const FORECAST_DAYS = 7;
export const FORECAST_HOURS = FORECAST_DAYS * 24;
export const CACHE_TTL_MS = 15 * 60 * 1000;
export const CACHE_PREFIX = "brixham-swim-cache:";
export const PREFERENCE_KEY = "brixham-swim-preferences";
export const DEFAULT_PREFERENCES = {
  thresholds: {
    preferred_tide: "High tide",
  },
};

export const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
weatherUrl.search = new URLSearchParams({
  latitude: BEACH.latitude,
  longitude: BEACH.longitude,
  timezone: BEACH.timezone,
  models: "ukmo_seamless",
  forecast_hours: FORECAST_HOURS,
  hourly: [
    "temperature_2m",
    "apparent_temperature",
    "precipitation_probability",
    "precipitation",
    "wind_speed_10m",
    "wind_gusts_10m",
    "wind_direction_10m",
    "weather_code",
  ].join(","),
  current: [
    "temperature_2m",
    "apparent_temperature",
    "precipitation",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "weather_code",
  ].join(","),
});

export const marineUrl = new URL("https://marine-api.open-meteo.com/v1/marine");
marineUrl.search = new URLSearchParams({
  latitude: BEACH.latitude,
  longitude: BEACH.longitude,
  timezone: BEACH.timezone,
  forecast_hours: FORECAST_HOURS,
  cell_selection: "sea",
  hourly: [
    "wave_height",
    "wave_direction",
    "wave_period",
    "wind_wave_height",
    "wind_wave_direction",
    "wind_wave_period",
    "swell_wave_height",
    "swell_wave_direction",
    "swell_wave_period",
    "secondary_swell_wave_height",
    "secondary_swell_wave_direction",
    "secondary_swell_wave_period",
    "sea_surface_temperature",
    "sea_level_height_msl",
    "ocean_current_velocity",
    "ocean_current_direction",
  ].join(","),
  current: [
    "wave_height",
    "wave_direction",
    "wave_period",
    "swell_wave_height",
    "sea_surface_temperature",
    "sea_level_height_msl",
    "ocean_current_velocity",
  ].join(","),
});

export const qualityUrl = new URL("https://environment.data.gov.uk/doc/bathing-water-quality/stp-risk-prediction.json");
qualityUrl.search = new URLSearchParams({
  _view: "all",
  _pageSize: 5,
  _sort: "-predictedAt",
  bwq_bathingWater: "http://environment.data.gov.uk/id/bathing-water/ukk4200-24500",
});

export const tidesUrl = "data/tides.json";
