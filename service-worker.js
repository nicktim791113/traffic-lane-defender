const CACHE_PREFIX = 'traffic-lane-defender';
const CACHE_VERSION = '20260516-pwa-v1';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/cars/blue-bus.png',
  './assets/cars/cement-mixer.png',
  './assets/cars/dump-truck.png',
  './assets/cars/mobile-crane.png',
  './assets/cars/orange-van.png',
  './assets/cars/purple-hatchback.png',
  './assets/cars/red-sedan.png',
  './assets/cars/road-roller.png',
  './assets/cars/tow-truck.png',
  './assets/cars/vehicle-preview.gif',
  './assets/cars/vehicle-sprites.json',
  './assets/cars/vehicle-sprites.png',
  './assets/cars/yellow-taxi.png',
  './assets/music/toy-car-battle.mp3',
  './assets/sounds/blue-bus.wav',
  './assets/sounds/cement-mixer.wav',
  './assets/sounds/dump-truck.wav',
  './assets/sounds/mobile-crane.wav',
  './assets/sounds/orange-van.wav',
  './assets/sounds/purple-hatchback.wav',
  './assets/sounds/red-sedan.wav',
  './assets/sounds/road-roller.wav',
  './assets/sounds/tow-truck.wav',
  './assets/sounds/vehicle-sounds-credits.json',
  './assets/sounds/vehicle-sounds.json',
  './assets/sounds/yellow-taxi.wav'
];

const CROSS_ORIGIN_RUNTIME_URLS = [
  'https://cdn.tailwindcss.com/'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' })));
    await Promise.all(CROSS_ORIGIN_RUNTIME_URLS.map((url) => warmRuntimeCache(cache, url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (CROSS_ORIGIN_RUNTIME_URLS.includes(url.href)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function warmRuntimeCache(cache, url) {
  try {
    const request = new Request(url, { mode: 'no-cors' });
    const response = await fetch(request);
    if (response) {
      await cache.put(url, response);
    }
  } catch (error) {
    // Optional CDN warmup should not block the local app shell cache.
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  await cacheResponse(request, response);
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackUrl) return caches.match(fallbackUrl);
    throw error;
  }
}

async function cacheResponse(request, response) {
  if (!response || (!response.ok && response.type !== 'opaque')) return;

  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (error) {
    // Ignore cache quota or opaque-response edge cases; the network response still wins.
  }
}
