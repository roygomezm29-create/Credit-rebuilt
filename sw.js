const CACHE_NAME = "capacidad-cache-v4";

// Archivos "dinámicos": el código de la app. Se sirven network-first para que
// una actualización de app.js/index.html se refleje de inmediato la próxima
// vez que se abra la app, en vez de quedar atorada detrás de una versión
// cacheada vieja del Service Worker (esto llegó a enmascarar los fixes de
// persistencia en iOS).
const NETWORK_FIRST = ["./", "./index.html", "./app.js"];

// Archivos "estáticos": íconos y manifest. Cambian poco, así que se sirven
// cache-first para carga instantánea. IMPORTANTE: si subes una imagen nueva
// para icons/icon-192.png, icons/icon-512.png o icons/apple-touch-icon.png
// SIN cambiar el nombre del archivo, debes subir también el número de
// CACHE_NAME de esta línea (ej. "capacidad-cache-v5"). Si no lo haces, los
// dispositivos que ya instalaron la PWA seguirán viendo el ícono viejo
// cacheado indefinidamente.
const CACHE_FIRST = [
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

const ASSETS = [...NETWORK_FIRST, ...CACHE_FIRST];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isNetworkFirst(request) {
  const url = new URL(request.url);
  return (
    request.mode === "navigate" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname === "/" ||
    url.pathname.endsWith("/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (isNetworkFirst(request)) {
    // Network-first: intenta traer la versión más reciente del código; si no
    // hay red, cae a la copia cacheada como respaldo offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first para el resto (íconos, manifest, etc.).
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
            return response;
          })
          .catch(() => cached)
      );
    })
  );
});
