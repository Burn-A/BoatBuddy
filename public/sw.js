/* eslint-disable no-restricted-globals */
/**
 * BoatBuddy service worker.
 *
 * Implements ARCHITECTURE.md §8:
 *   - App shell (HTML + Next.js static assets): cache-first.
 *   - Mapbox tiles: cache-first into a dedicated cache so they survive
 *     offline and across sessions.
 *   - First-party /api/* (NOAA / OSM proxies): network-first with cache
 *     fallback so the last-good observation is shown when offline.
 *
 * Hand-rolled, no Workbox, no build-time injection — kept as a plain
 * static asset so it stays grokkable and dependency-free.
 */

const APP_CACHE = 'bb-app-v1';
const TILE_CACHE = 'bb-tiles-v1';
const API_CACHE = 'bb-api-v1';

const APP_SHELL = ['/', '/profile', '/manifest.webmanifest', '/icon.svg'];

/** Tile cache LRU cap; prevents unbounded growth (NFR-020). */
const TILE_CACHE_MAX_ENTRIES = 800;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      // Don't fail the install if any single shell URL can't be fetched
      // (e.g. /profile is a non-public path during first-time install).
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const allowed = new Set([APP_CACHE, TILE_CACHE, API_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !allowed.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Mapbox tiles & sprites — heavy & immutable per URL — cache-first.
  if (
    url.hostname.endsWith('mapbox.com') ||
    url.hostname.endsWith('tiles.mapbox.com') ||
    url.hostname.endsWith('api.mapbox.com')
  ) {
    event.respondWith(cacheFirst(request, TILE_CACHE, TILE_CACHE_MAX_ENTRIES));
    return;
  }

  // Same-origin static assets (Next.js builds them under /_next/static).
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, APP_CACHE));
    return;
  }

  // First-party API — network-first with cache fallback so offline mode
  // can still show the last-good NOAA observation.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // HTML navigations.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, APP_CACHE));
    return;
  }
});

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      if (maxEntries) trimCache(cacheName, maxEntries);
    }
    return response;
  } catch (err) {
    return new Response('Offline and resource not cached.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      // Add a header the client can read to surface "stale offline" state.
      const headers = new Headers(cached.headers);
      headers.set('X-BoatBuddy-Source', 'cache-offline');
      return new Response(await cached.blob(), {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    return new Response(JSON.stringify({ error: 'Offline.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * LRU-style trim by deletion of the oldest entries.
 *
 * The Cache Storage API doesn't expose mtime, so we approximate
 * "oldest" with insertion order, which `cache.keys()` returns.
 */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const surplus = keys.length - maxEntries;
  for (let i = 0; i < surplus; i++) {
    await cache.delete(keys[i]);
  }
}

// Allow the page to request "warm this URL" (used by the tile-warmer
// to ensure a fetched tile makes it into the cache even if the SW
// didn't intercept the request).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'BB_WARM_TILE' && typeof event.data.url === 'string') {
    event.waitUntil(
      (async () => {
        try {
          const resp = await fetch(event.data.url);
          if (resp.ok) {
            const cache = await caches.open(TILE_CACHE);
            await cache.put(event.data.url, resp);
            await trimCache(TILE_CACHE, TILE_CACHE_MAX_ENTRIES);
          }
        } catch {
          // Best-effort.
        }
      })(),
    );
  }
});
