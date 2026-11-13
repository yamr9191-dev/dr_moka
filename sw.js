/* My Planner — production-minded service worker with automatic updates. */
'use strict';

const CACHE_PREFIX = 'my-planner-cache-';
const CACHE_VERSION = '2026-11-13-1';
const CURRENT_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  // Activate the newest version without waiting for the old app to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CURRENT_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Always ask the server for the latest HTML when online. This is the key
  // that prevents installed phones from being stuck on an old app shell.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CURRENT_CACHE);
          await cache.put(request, fresh.clone());
        }
        return fresh;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fallback = await caches.match(new URL('./', self.registration.scope).href);
        if (fallback) return fallback;
        throw error;
      }
    })());
    return;
  }

  // Network-first for same-origin assets, with a cached fallback when offline.
  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response && response.ok) {
        const cache = await caches.open(CURRENT_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
