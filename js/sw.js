// Service Worker — VV Global PWA
// Estrategia: network-only (siempre conectado)
// Solo necesario para que el navegador reconozca la app como instalable

const CACHE_NAME = "vv-global-v1";

// Al instalar, cachear los archivos estáticos de la app
self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll([
        "/sucursal.html",
        "/sucursal.css",
        "/sucursal.js",
        "/dashboard.html",
        "/dashboard.css",
        "/dashboard.js",
        "/icons/icon-192.png",
        "/icons/icon-512.png"
      ]);
    })
  );
  self.skipWaiting();
});

// Al activar, limpiar caches viejas
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

// Fetch: intentar red primero, fallback a cache para archivos propios
// Para Firebase y CDNs externos, siempre red
self.addEventListener("fetch", function(event) {
  var url = event.request.url;

  // Firebase, CDNs y fuentes: siempre red (nunca cachear)
  if (url.includes("firebase") ||
      url.includes("gstatic") ||
      url.includes("cloudflare") ||
      url.includes("fonts.googleapis") ||
      url.includes("fonts.gstatic")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Archivos propios: red primero, cache como fallback
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Actualizar cache con la versión fresca
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
