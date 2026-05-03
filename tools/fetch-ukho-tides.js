import { mkdir, writeFile } from "node:fs/promises";

const stationId = process.env.UKHO_STATION_ID || "0025";
const apiKey = process.env.UKHO_API_KEY;
const outputPath = process.env.TIDES_OUTPUT || "data/tides.json";

if (!apiKey) {
  throw new Error("Missing UKHO_API_KEY environment variable");
}

const url = new URL(`https://admiraltyapi.azure-api.net/uktidalapi/api/V1/Stations/${stationId}/TidalEvents`);

const response = await fetch(url, {
  headers: {
    "Ocp-Apim-Subscription-Key": apiKey,
    "Cache-Control": "no-cache",
  },
});

if (!response.ok) {
  throw new Error(`UKHO tidal events request failed: ${response.status} ${response.statusText}`);
}

const source = await response.json();
const events = Array.isArray(source) ? source : source.tidalEvents || source.events || source.items || [];

const tides = {
  source: "UKHO ADMIRALTY Tidal API",
  stationId,
  generatedAt: new Date().toISOString(),
  rawShape: Array.isArray(source) ? "array" : Object.keys(source || {}).sort(),
  events,
};

await mkdir(outputPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
await writeFile(outputPath, `${JSON.stringify(tides, null, 2)}\n`);

console.log(`Wrote ${events.length} UKHO tide events to ${outputPath}`);
