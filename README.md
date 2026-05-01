# Brixham Swim Forecast

A mobile-first prototype for focused swimming conditions at Breakwater Beach / Shoalstone, Brixham.

## What the prototype does

- Shows current wind, waves, sea surface temperature and modelled sea level.
- Shows a satellite-style beach panel with live overlays for wind direction, wave height, tide level and sea temperature.
- Scores swim conditions from 0-100 using wind, gusts, wave height, swell, rain risk and water temperature.
- Lists the best daylight swim windows.
- Gives an 8-day outlook backed by both weather and marine data.
- Runs as a simple progressive web app that can be opened on an iPhone and added to the home screen.

## Project structure

```text
index.html
questionnaire.html
manifest.json
src/       app entry, config, data, scoring, rendering and preferences
styles/    shared app styles
docs/      questionnaire source docs and answer template
archive/   older generated questionnaire page
tests/     lightweight scoring checks
tools/     local static server
```

## Local iteration

```bash
npm run dev
npm run check
npm test
```

If `npm` is unavailable, use:

```bash
node tools/static-server.js
node --check src/app.js
node tests/scoring.test.js
```

## Forecast horizon

Two weeks is a reasonable maximum for a planning view, but the first working version uses 8 days because the standard Open-Meteo marine endpoint documents an 8-day `forecast_days` limit even though some underlying wave models run longer. The production app should treat longer forecasts as three confidence bands:

- 0-72 hours: useful for real decisions.
- 3-7 days: good for planning, re-check before swimming.
- 8-14 days: trend only.

Sea state and wind are especially sensitive near the coast, so the UX should never imply that day 12 is as reliable as tomorrow morning.

## Data source plan

Prototype:

- Weather: Open-Meteo Forecast API, which provides hourly weather forecasts up to 16 days.
- Marine: Open-Meteo Marine API for wave height, period, swell, sea surface temperature, ocean current and modelled sea level.
- Official tide check: ADMIRALTY EasyTide for Brixham, currently linked in the app.

Production recommended stack:

- Weather: Met Office Weather DataHub, ideally UKV 2 km data for UK short-range forecasts.
- Sea state: Open-Meteo marine as a pragmatic starting point, then compare with ECMWF/DWD wave models and any local buoy or harbour data that becomes available.
- Tides: UKHO Admiralty Tidal API. The free Discovery tier covers current plus six days of tidal events; Premium covers much longer ranges and interval predictions.
- Bathing water: Environment Agency Bathing Water Quality API and Swimfo status for classifications, samples and pollution risk warnings.
- Overflow alerts: South West Water WaterFit Live for Breakwater Beach / Shoalstone storm overflow status, subject to API availability or data-sharing terms.

## Safety and product notes

The score is only a decision-support signal. The app should always defer to local signage, lifeguard flags, official bathing water warnings, and the swimmer's ability, equipment and health.

For a production app, add:

- A backend proxy so API keys are not exposed in the iPhone app.
- Source timestamps and confidence labels beside every condition.
- Push notifications for good morning swim windows and water-quality warnings.
- A visible "not for navigation" notice for tide and sea-state data.
- A configurable beach profile, even if the first release defaults to Breakwater Beach.

## Sources checked

- Open-Meteo Weather Forecast API: https://open-meteo.com/en/docs
- Open-Meteo Marine Weather API: https://open-meteo.com/en/docs/marine-weather-api
- Met Office Weather DataHub: https://www.metoffice.gov.uk/services/data/met-office-weather-datahub
- UKHO Admiralty EasyTide and Tidal API information: https://www.admiralty.co.uk/access-data/tidal-data/easy-tide
- UK Tidal API catalogue: https://www.api.gov.uk/ukho/uk-tidal-api-discovery/
- Environment Agency Bathing Water Quality API: https://environment.data.gov.uk/bwq
- South West Water WaterFit Live, Breakwater Beach: https://www.southwestwater.co.uk/breakwater-shoalstone
