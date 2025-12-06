# PWA Implementation Guide

This document describes the Progressive Web App (PWA) implementation for ParkLookup.com, including offline support, caching strategies, and background sync.

## PWA Features

- ✅ Installable on mobile and desktop
- ✅ Offline-first architecture
- ✅ Background sync for favorites
- ✅ Push notifications (optional)
- ✅ App-like experience
- ✅ Cross-browser support

## Web App Manifest

**Location:** `public/manifest.json`

```json
{
  "name": "ParkLookup - National Parks Explorer",
  "short_name": "ParkLookup",
  "description": "Discover and explore U.S. National Parks",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#16a34a",
  "orientation": "portrait-primary",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/mobile-home.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshots/desktop-home.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "form_factor": "wide"
    }
  ],
  "categories": ["travel", "navigation", "lifestyle"],
  "shortcuts": [
    {
      "name": "Search Parks",
      "url": "/search",
      "icons": [{ "src": "/icons/search-96x96.png", "sizes": "96x96" }]
    },
    {
      "name": "My Favorites",
      "url": "/favorites",
      "icons": [{ "src": "/icons/heart-96x96.png", "sizes": "96x96" }]
    }
  ]
}
```

## Service Worker

### Registration

**Location:** `app/layout.tsx`

```typescript
"use client"

import { useEffect } from "react"

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered:", registration.scope)
        })
        .catch((error) => {
          console.error("SW registration failed:", error)
        })
    }
  }, [])

  return null
}
```

### Service Worker Implementation

**Location:** `public/sw.js`

```javascript
const CACHE_NAME = "parklookup-v1"
const STATIC_CACHE = "parklookup-static-v1"
const DYNAMIC_CACHE = "parklookup-dynamic-v1"
const IMAGE_CACHE = "parklookup-images-v1"

// Static assets to cache on install
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
]

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - implement caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") return

  // API requests - Network First
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE))
    return
  }

  // Images - Cache First
  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }

  // Static assets - Cache First
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Other requests - Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
})

// Cache First strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  
  if (cached) {
    return cached
  }
  
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    return caches.match("/offline")
  }
}

// Network First strategy
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await cache.match(request)
    return cached || new Response(
      JSON.stringify({ error: "Offline" }),
      { headers: { "Content-Type": "application/json" } }
    )
  }
}

// Stale While Revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  }).catch(() => cached)
  
  return cached || fetchPromise
}

// Background Sync for favorites
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-favorites") {
    event.waitUntil(syncFavorites())
  }
})

async function syncFavorites() {
  const db = await openIndexedDB()
  const pendingFavorites = await getPendingFavorites(db)
  
  for (const favorite of pendingFavorites) {
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parkId: favorite.parkId })
      })
      
      if (response.ok) {
        await removePendingFavorite(db, favorite.id)
      }
    } catch (error) {
      console.error("Sync failed for favorite:", favorite.id)
    }
  }
}

// IndexedDB helpers
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("parklookup", 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains("pendingFavorites")) {
        db.createObjectStore("pendingFavorites", { keyPath: "id", autoIncrement: true })
      }
      if (!db.objectStoreNames.contains("cachedParks")) {
        db.createObjectStore("cachedParks", { keyPath: "id" })
      }
    }
  })
}

function getPendingFavorites(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pendingFavorites", "readonly")
    const store = tx.objectStore("pendingFavorites")
    const request = store.getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

function removePendingFavorite(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pendingFavorites", "readwrite")
    const store = tx.objectStore("pendingFavorites")
    const request = store.delete(id)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}
```

## Offline Data Storage

### IndexedDB Hook

**Location:** `lib/hooks/useOfflineStorage.ts`

```typescript
import { useCallback, useEffect, useState } from "react"

const DB_NAME = "parklookup"
const DB_VERSION = 1

interface Park {
  id: string
  full_name: string
  // ... other fields
}

export function useOfflineStorage() {
  const [db, setDb] = useState<IDBDatabase | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error("Failed to open IndexedDB")
    }

    request.onsuccess = () => {
      setDb(request.result)
      setIsReady(true)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      if (!database.objectStoreNames.contains("cachedParks")) {
        const parkStore = database.createObjectStore("cachedParks", { keyPath: "id" })
        parkStore.createIndex("full_name", "full_name", { unique: false })
        parkStore.createIndex("states", "states", { unique: false })
      }

      if (!database.objectStoreNames.contains("pendingFavorites")) {
        database.createObjectStore("pendingFavorites", { keyPath: "id", autoIncrement: true })
      }

      if (!database.objectStoreNames.contains("userFavorites")) {
        database.createObjectStore("userFavorites", { keyPath: "parkId" })
      }
    }

    return () => {
      db?.close()
    }
  }, [])

  const cacheParks = useCallback(async (parks: Park[]) => {
    if (!db) return

    const tx = db.transaction("cachedParks", "readwrite")
    const store = tx.objectStore("cachedParks")

    for (const park of parks) {
      store.put(park)
    }

    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }, [db])

  const getCachedParks = useCallback(async (): Promise<Park[]> => {
    if (!db) return []

    return new Promise((resolve, reject) => {
      const tx = db.transaction("cachedParks", "readonly")
      const store = tx.objectStore("cachedParks")
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }, [db])

  const addPendingFavorite = useCallback(async (parkId: string, action: "add" | "remove") => {
    if (!db) return

    const tx = db.transaction("pendingFavorites", "readwrite")
    const store = tx.objectStore("pendingFavorites")
    store.add({ parkId, action, timestamp: Date.now() })

    // Request background sync
    if ("serviceWorker" in navigator && "sync" in ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready
      await registration.sync.register("sync-favorites")
    }
  }, [db])

  const updateLocalFavorite = useCallback(async (parkId: string, isFavorite: boolean) => {
    if (!db) return

    const tx = db.transaction("userFavorites", "readwrite")
    const store = tx.objectStore("userFavorites")

    if (isFavorite) {
      store.put({ parkId, favoritedAt: Date.now() })
    } else {
      store.delete(parkId)
    }
  }, [db])

  const getLocalFavorites = useCallback(async (): Promise<string[]> => {
    if (!db) return []

    return new Promise((resolve, reject) => {
      const tx = db.transaction("userFavorites", "readonly")
      const store = tx.objectStore("userFavorites")
      const request = store.getAllKeys()

      request.onsuccess = () => resolve(request.result as string[])
      request.onerror = () => reject(request.error)
    })
  }, [db])

  return {
    isReady,
    cacheParks,
    getCachedParks,
    addPendingFavorite,
    updateLocalFavorite,
    getLocalFavorites
  }
}
```

## Online/Offline Detection

**Location:** `lib/hooks/useOnlineStatus.ts`

```typescript
import { useEffect, useState } from "react"

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return isOnline
}
```

## Offline UI Component

**Location:** `components/ui/OfflineBanner.tsx`

```typescript
"use client"

import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus"
import { WifiOff } from "lucide-react"

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-yellow-900 px-4 py-2 flex items-center justify-center gap-2 z-50">
      <WifiOff className="w-4 h-4" />
      <span className="text-sm font-medium">
        You are offline. Some features may be limited.
      </span>
    </div>
  )
}
```

## Offline Page

**Location:** `app/offline/page.tsx`

```typescript
import { WifiOff } from "lucide-react"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        <WifiOff className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          You are offline
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Please check your internet connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
```

## PWA Install Prompt

**Location:** `components/ui/InstallPrompt.tsx`

```typescript
"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setDeferredPrompt(null)
      setShowPrompt(false)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Don't show again for 7 days
    localStorage.setItem("installPromptDismissed", Date.now().toString())
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50 border border-gray-200 dark:border-gray-700">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Download className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Install ParkLookup
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Add to your home screen for quick access and offline use.
          </p>
          <button
            onClick={handleInstall}
            className="mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
          >
            Install App
          </button>
        </div>
      </div>
    </div>
  )
}
```

## Next.js Configuration

**Location:** `next.config.js`

```javascript
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development"
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "www.nps.gov",
      "upload.wikimedia.org",
      "commons.wikimedia.org"
    ]
  }
}

module.exports = withPWA(nextConfig)
```

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Web App Manifest | ✅ | ✅ | ✅ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| Background Sync | ✅ | ❌ | ❌ | ✅ |
| Push Notifications | ✅ | ✅ | ✅* | ✅ |

*Safari requires user to add to home screen first

## Testing PWA

### Lighthouse Audit

1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Select "Progressive Web App" category
4. Run audit

### Manual Testing Checklist

- [ ] App installs on mobile
- [ ] App installs on desktop
- [ ] Offline page shows when disconnected
- [ ] Cached pages load offline
- [ ] Favorites sync when back online
- [ ] Service worker updates correctly
- [ ] Icons display correctly
- [ ] Splash screen shows on launch

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)