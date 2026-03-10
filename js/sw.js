// Service Worker — VV Global PWA
const CACHE_NAME = "vv-global-v3";
const BASE = "/vv-global";

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll([
        BASE + "/sucursal.html",
        BASE + "/dashboard.html",
        BASE + "/manifest.json",
        BASE + "/styles/sucursal.css",
        BASE + "/styles/dashboard.css",
        BASE + "/js/sucursal.js",
        BASE + "/js/dashboard.js",
        BASE + "/icons/icon-192.png",
        BASE + "/icons/icon-512.png"
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event) {
  var url = event.request.url;

  // Siempre desde la red: Firebase, CDNs, fuentes
  if (url.includes("firebase") ||
      url.includes("gstatic") ||
      url.includes("cloudflare") ||
      url.includes("fonts.googleapis") ||
      url.includes("fonts.gstatic")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first, cache como fallback
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(function() {
        return caches.match(event.request);
      })
  );
});