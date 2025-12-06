/**
 * Service Worker for ParkLookup PWA
 * Handles caching, offline support, and background sync
 */

const CACHE_NAME = 'parklookup-v1';
const STATIC_CACHE = 'parklookup-static-v1';
const DYNAMIC_CACHE = 'parklookup-dynamic-v1';
const API_CACHE = 'parklookup-api-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/parks',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API routes to cache
const API_ROUTES = ['/api/parks'];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return (
                name.startsWith('parklookup-') &&
                name !== STATIC_CACHE &&
                name !== DYNAMIC_CACHE &&
                name !== API_CACHE
              );
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets and pages
  event.respondWith(handleStaticRequest(request));
});

/**
 * Handle API requests with network-first strategy
 */
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Fallback to cache if offline
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log('[SW] Serving API from cache:', request.url);
      return cachedResponse;
    }

    // Return offline response
    return new Response(
      JSON.stringify({
        error: 'You are offline',
        offline: true,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle static requests with cache-first strategy
 */
async function handleStaticRequest(request) {
  // Check static cache first
  const staticCache = await caches.open(STATIC_CACHE);
  const staticResponse = await staticCache.match(request);

  if (staticResponse) {
    // Return cached response and update cache in background
    updateCache(request, DYNAMIC_CACHE);
    return staticResponse;
  }

  // Check dynamic cache
  const dynamicCache = await caches.open(DYNAMIC_CACHE);
  const dynamicResponse = await dynamicCache.match(request);

  if (dynamicResponse) {
    return dynamicResponse;
  }

  // Fetch from network
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      dynamicCache.put(request, responseClone);
    }

    return networkResponse;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await staticCache.match('/');
      if (offlinePage) {
        return offlinePage;
      }
    }

    // Return generic offline response
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Update cache in background
 */
async function updateCache(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response);
    }
  } catch (error) {
    // Silently fail - we already have a cached version
  }
}

// Background sync for favorites
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncFavorites());
  }
});

/**
 * Sync favorites when back online
 */
async function syncFavorites() {
  try {
    // Get pending favorites from IndexedDB
    const db = await openDatabase();
    const pendingFavorites = await getPendingFavorites(db);

    for (const favorite of pendingFavorites) {
      try {
        const response = await fetch('/api/favorites', {
          method: favorite.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(favorite.data),
        });

        if (response.ok) {
          await removePendingFavorite(db, favorite.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync favorite:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Failed to sync favorites:', error);
  }
}

/**
 * Open IndexedDB database
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('parklookup', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('pending-favorites')) {
        db.createObjectStore('pending-favorites', { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains('cached-parks')) {
        db.createObjectStore('cached-parks', { keyPath: 'park_code' });
      }
    };
  });
}

/**
 * Get pending favorites from IndexedDB
 */
function getPendingFavorites(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-favorites'], 'readonly');
    const store = transaction.objectStore('pending-favorites');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Remove pending favorite from IndexedDB
 */
function removePendingFavorite(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-favorites'], 'readwrite');
    const store = transaction.objectStore('pending-favorites');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  const data = event.data?.json() ?? {
    title: 'ParkLookup',
    body: 'New update available!',
  };

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'close',
        title: 'Close',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }

      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

console.log('[SW] Service worker loaded');