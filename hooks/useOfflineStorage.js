'use client';

import { useCallback, useEffect, useState } from 'react';

const DB_NAME = 'parklookup';
const DB_VERSION = 1;

/**
 * Hook for offline data storage using IndexedDB
 * @returns {Object} - Storage utilities
 */
export function useOfflineStorage() {
  const [db, setDb] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  // Initialize IndexedDB
  useEffect(() => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      setError('IndexedDB not supported');
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      setError('Failed to open IndexedDB');
      console.error('IndexedDB error:', request.error);
    };

    request.onsuccess = () => {
      setDb(request.result);
      setIsReady(true);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create object stores if they don't exist
      if (!database.objectStoreNames.contains('cachedParks')) {
        const parkStore = database.createObjectStore('cachedParks', {
          keyPath: 'id',
        });
        parkStore.createIndex('park_code', 'park_code', { unique: true });
        parkStore.createIndex('full_name', 'full_name', { unique: false });
        parkStore.createIndex('states', 'states', { unique: false });
      }

      if (!database.objectStoreNames.contains('pendingFavorites')) {
        database.createObjectStore('pendingFavorites', {
          keyPath: 'id',
          autoIncrement: true,
        });
      }

      if (!database.objectStoreNames.contains('userFavorites')) {
        database.createObjectStore('userFavorites', { keyPath: 'parkId' });
      }

      if (!database.objectStoreNames.contains('searchHistory')) {
        const searchStore = database.createObjectStore('searchHistory', {
          keyPath: 'id',
          autoIncrement: true,
        });
        searchStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    return () => {
      if (db) {
        db.close();
      }
    };
  }, []);

  /**
   * Cache parks for offline access
   * @param {Array} parks - Array of park objects
   */
  const cacheParks = useCallback(
    async (parks) => {
      if (!db || !parks?.length) return;

      return new Promise((resolve, reject) => {
        const tx = db.transaction('cachedParks', 'readwrite');
        const store = tx.objectStore('cachedParks');

        for (const park of parks) {
          store.put({
            ...park,
            cachedAt: Date.now(),
          });
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    [db]
  );

  /**
   * Get cached parks
   * @returns {Promise<Array>} - Array of cached parks
   */
  const getCachedParks = useCallback(async () => {
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction('cachedParks', 'readonly');
      const store = tx.objectStore('cachedParks');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  /**
   * Get a cached park by park code
   * @param {string} parkCode - Park code
   * @returns {Promise<Object|null>} - Park object or null
   */
  const getCachedPark = useCallback(
    async (parkCode) => {
      if (!db) return null;

      return new Promise((resolve, reject) => {
        const tx = db.transaction('cachedParks', 'readonly');
        const store = tx.objectStore('cachedParks');
        const index = store.index('park_code');
        const request = index.get(parkCode);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    },
    [db]
  );

  /**
   * Add a pending favorite action (for offline sync)
   * @param {string} parkId - Park ID
   * @param {string} action - 'add' or 'remove'
   */
  const addPendingFavorite = useCallback(
    async (parkId, action) => {
      if (!db) return;

      return new Promise((resolve, reject) => {
        const tx = db.transaction('pendingFavorites', 'readwrite');
        const store = tx.objectStore('pendingFavorites');
        store.add({
          parkId,
          action,
          timestamp: Date.now(),
        });

        tx.oncomplete = async () => {
          // Request background sync if available
          if (
            'serviceWorker' in navigator &&
            'sync' in ServiceWorkerRegistration.prototype
          ) {
            try {
              const registration = await navigator.serviceWorker.ready;
              await registration.sync.register('sync-favorites');
            } catch (err) {
              console.warn('Background sync not available:', err);
            }
          }
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    },
    [db]
  );

  /**
   * Get pending favorite actions
   * @returns {Promise<Array>} - Array of pending actions
   */
  const getPendingFavorites = useCallback(async () => {
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingFavorites', 'readonly');
      const store = tx.objectStore('pendingFavorites');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  /**
   * Remove a pending favorite action
   * @param {number} id - Pending action ID
   */
  const removePendingFavorite = useCallback(
    async (id) => {
      if (!db) return;

      return new Promise((resolve, reject) => {
        const tx = db.transaction('pendingFavorites', 'readwrite');
        const store = tx.objectStore('pendingFavorites');
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
    [db]
  );

  /**
   * Update local favorite status
   * @param {string} parkId - Park ID
   * @param {boolean} isFavorite - Whether the park is a favorite
   */
  const updateLocalFavorite = useCallback(
    async (parkId, isFavorite) => {
      if (!db) return;

      return new Promise((resolve, reject) => {
        const tx = db.transaction('userFavorites', 'readwrite');
        const store = tx.objectStore('userFavorites');

        if (isFavorite) {
          store.put({ parkId, favoritedAt: Date.now() });
        } else {
          store.delete(parkId);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    [db]
  );

  /**
   * Get local favorites
   * @returns {Promise<Array<string>>} - Array of park IDs
   */
  const getLocalFavorites = useCallback(async () => {
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction('userFavorites', 'readonly');
      const store = tx.objectStore('userFavorites');
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  /**
   * Check if a park is a local favorite
   * @param {string} parkId - Park ID
   * @returns {Promise<boolean>}
   */
  const isLocalFavorite = useCallback(
    async (parkId) => {
      if (!db) return false;

      return new Promise((resolve, reject) => {
        const tx = db.transaction('userFavorites', 'readonly');
        const store = tx.objectStore('userFavorites');
        const request = store.get(parkId);

        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => reject(request.error);
      });
    },
    [db]
  );

  /**
   * Add to search history
   * @param {string} query - Search query
   */
  const addSearchHistory = useCallback(
    async (query) => {
      if (!db || !query?.trim()) return;

      return new Promise((resolve, reject) => {
        const tx = db.transaction('searchHistory', 'readwrite');
        const store = tx.objectStore('searchHistory');
        store.add({
          query: query.trim(),
          timestamp: Date.now(),
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    [db]
  );

  /**
   * Get recent search history
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>}
   */
  const getSearchHistory = useCallback(
    async (limit = 10) => {
      if (!db) return [];

      return new Promise((resolve, reject) => {
        const tx = db.transaction('searchHistory', 'readonly');
        const store = tx.objectStore('searchHistory');
        const index = store.index('timestamp');
        const request = index.openCursor(null, 'prev');
        const results = [];

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && results.length < limit) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        request.onerror = () => reject(request.error);
      });
    },
    [db]
  );

  /**
   * Clear all cached data
   */
  const clearCache = useCallback(async () => {
    if (!db) return;

    const stores = ['cachedParks', 'pendingFavorites', 'userFavorites', 'searchHistory'];

    for (const storeName of stores) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }, [db]);

  return {
    isReady,
    error,
    cacheParks,
    getCachedParks,
    getCachedPark,
    addPendingFavorite,
    getPendingFavorites,
    removePendingFavorite,
    updateLocalFavorite,
    getLocalFavorites,
    isLocalFavorite,
    addSearchHistory,
    getSearchHistory,
    clearCache,
  };
}

export default useOfflineStorage;