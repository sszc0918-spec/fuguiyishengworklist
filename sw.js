// Service Worker - PWA offline support and caching strategy
// v1.0.2 - Auth Refactor Update

// 🔧 使用时间戳版本号确保每次部署都清除旧缓存
const BUILD_TIMESTAMP = '2026-05-26-006';  // 部署时请更新此时间戳
const CACHE_VERSION = `worklist-v3-${BUILD_TIMESTAMP}`;
const RUNTIME_CACHE = `worklist-runtime-v3-${BUILD_TIMESTAMP}`;
const FIREBASE_CACHE = `worklist-firebase-v3-${BUILD_TIMESTAMP}`;

// Resources to be cached immediately on first load
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './apple-touch-icon.png',
  './favicon.png',
  './logo.png',
  './ios-optimizer.js'
];

// iOS detection helper
// iOS detection – works in Service Worker (no window object)
const isIOS = () => /iPad|iPhone|iPod/.test(self.navigator.userAgent);

// Firebase SDK and third-party libraries are cached dynamically

// Installation phase: create cache and cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing... iOS detection:', isIOS());
  
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // Cache critical URLs one by one for better iOS compatibility
        const cachePromises = PRECACHE_URLS.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to cache ${url}:`, err);
            return Promise.resolve();
          });
        });
        return Promise.all(cachePromises);
      })
      .catch((err) => {
        console.error('[SW] Cache open failed:', err);
        return Promise.resolve();
      })
      .then(() => {
        console.log('[SW] Forcing SW activation');
        return self.skipWaiting();
      })
  );
});

// Activation phase: clean up old cache versions
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION && name !== RUNTIME_CACHE && name !== FIREBASE_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Immediately take over all pages
      return self.clients.claim();
    })
  );
});

// Fetch phase: implement caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignore Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // 🚨 修复: 非 GET 请求 (POST, PUT, DELETE 等) 直接走网络
  // Firebase Auth 和 数据库写操作必须直接通过网络，否则会报 auth/network-request-failed
if (request.method !== 'GET') {
  event.respondWith(
    fetch(request).catch(() =>
      new Response(JSON.stringify({ error: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    )
  );
  return;
}
  
  // Firebase and Google API requests - Network First strategy with iOS fixes
  // gstatic.com hosts Firebase SDK files (firebase-app.js, firebase-auth.js, firebase-firestore.js)
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('gstatic.com')) {
    event.respondWith(
      fetch(request, {
        mode: 'cors',
        credentials: 'include',
        cache: 'no-cache'
      })
        .then((response) => {
          console.log('[SW] Firebase fetch success:', url.hostname, response.status);
          // Cache a copy when response is successful
          if (response && response.status === 200) {
            try {
              const responseClone = response.clone();
              caches.open(FIREBASE_CACHE)
                .then((cache) => cache.put(request, responseClone))
                .catch((err) => console.warn('[SW] Firebase cache put failed:', err));
            } catch (err) {
              console.warn('[SW] Firebase response clone failed:', err);
            }
          }
          return response;
        })
        .catch((fetchErr) => {
          console.warn('[SW] Firebase fetch failed:', fetchErr.message);
          // Network failed, try to get from cache
          return caches.match(request)
            .then((cached) => {
              if (cached) {
                console.log('[SW] Using cached Firebase response');
                return cached;
              }
              // No cache, return offline response
              console.log('[SW] No cache available for Firebase request');
              return new Response(
                JSON.stringify({ offline: true, message: 'Firebase service unavailable. Local changes will sync when online.' }),
                { 
                  status: 503, 
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            })
            .catch((cacheErr) => {
              console.error('[SW] Cache match failed:', cacheErr.message);
              return new Response(
                JSON.stringify({ offline: true, error: 'Service Worker error' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
              );
            });
        })
    );
    return;
  }
  
  // index.html - Network First to always get latest version
  if (request.method === 'GET' && (url.pathname.endsWith('/') || url.pathname.endsWith('index.html'))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseToCache));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Other local resources - Cache First strategy
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            console.log('[SW] Serving from cache:', request.url);
            return cached;
          }
          return fetch(request, { cache: 'no-cache' })
            .then((response) => {
              if (!response || response.status !== 200 || response.type === 'error') {
                console.warn('[SW] Response not cacheable:', request.url, response.status);
                return response;
              }
              try {
                const responseToCache = response.clone();
                caches.open(RUNTIME_CACHE)
                  .then((cache) => cache.put(request, responseToCache))
                  .catch((err) => console.warn('[SW] Cache put failed:', err));
              } catch (err) {
                console.warn('[SW] Response clone failed:', err);
              }
              return response;
            })
            .catch((fetchErr) => {
              console.log('[SW] Offline - no cache for:', request.url, fetchErr.message);
              return new Response('Offline - Resource not available', { status: 503, statusText: 'Service Unavailable' });
            });
        })
        .catch((cacheErr) => {
          console.error('[SW] Cache match error:', cacheErr.message);
          return fetch(request, { cache: 'no-cache' })
            .catch(() => new Response('Service Worker error', { status: 503 }));
        })
    );
    return;
          }
});

// Message handling: support page-initiated cache updates or clearing
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(RUNTIME_CACHE).then((cache) => {
      cache.addAll(urls).catch((err) => {
        console.warn('[SW] Failed to cache URLs:', err);
      });
    });
  }
});

// Periodic background sync (optional: requires browser support)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-firebase-data') {
      console.log('[SW] Periodic sync triggered');
      event.waitUntil(
        // Logic for periodic Firebase data sync can be added here
        Promise.resolve()
      );
    }
  });
}

// iOS specific fixes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'iOS_SYNC') {
    console.log('[SW] iOS sync requested');
    // Trigger sync
    event.waitUntil(Promise.resolve());
  }
});

console.log('[SW] Service Worker loaded successfully - iOS compatible v1.0.1');
