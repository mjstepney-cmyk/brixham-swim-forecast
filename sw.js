const CACHE_NAME = "brixham-swim-forecast-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles/styles.css",
  "./src/app.js",
  "./src/config.js",
  "./src/data.js",
  "./src/preferences.js",
  "./src/render.js",
  "./src/scoring.js",
  "./src/utils.js",
  "./icons/app-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
