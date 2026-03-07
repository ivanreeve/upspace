const CACHE_NAME = 'upspace-pwa-v2';
const OFFLINE_URL = '/';

// Only cache truly static assets that never change per-user.
const PRECACHE_URLS = ['/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => {
        console.error('Failed to pre-cache assets:', error);
      })
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Never cache navigation requests (HTML pages), API calls, or Next.js data
  // requests.  These are user-specific and must always be fresh from the
  // server to reflect the current session and role.
  const isNavigation = event.request.mode === 'navigate';
  const isApi = requestUrl.pathname.startsWith('/api/');
  const isNextData = requestUrl.pathname.startsWith('/_next/data/');
  const isRSC = requestUrl.searchParams.has('_rsc');

  if (isNavigation || isApi || isNextData || isRSC) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline fallback for navigation only
        if (isNavigation) {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Network error', { status: 503, });
      })
    );
    return;
  }

  // For static assets (_next/static, images, fonts, etc.), use
  // stale-while-revalidate: serve from cache if available, then update the
  // cache in the background.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type === 'opaque'
          ) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));

          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
