/**
 * useServiceWorker Hook
 * Registers and manages the service worker
 */

'use client';

import { useEffect, useState } from 'react';

export function useServiceWorker() {
  const [registration, setRegistration] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check if service workers are supported
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Register service worker
    const registerServiceWorker = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        setRegistration(reg);
        console.log('[App] Service worker registered');

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;

          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
              console.log('[App] New service worker available');
            }
          });
        });

        // Check for updates periodically
        setInterval(
          () => {
            reg.update();
          },
          60 * 60 * 1000
        ); // Every hour
      } catch (error) {
        console.error('[App] Service worker registration failed:', error);
      }
    };

    registerServiceWorker();

    // Handle online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial offline status
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update service worker
  const updateServiceWorker = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  // Subscribe to push notifications
  const subscribeToPush = async () => {
    if (!registration) {
      return null;
    }

    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      return subscription;
    } catch (error) {
      console.error('[App] Push subscription failed:', error);
      return null;
    }
  };

  // Register background sync
  const registerBackgroundSync = async (tag) => {
    if (!registration || !('sync' in registration)) {
      return false;
    }

    try {
      await registration.sync.register(tag);
      return true;
    } catch (error) {
      console.error('[App] Background sync registration failed:', error);
      return false;
    }
  };

  return {
    registration,
    updateAvailable,
    isOffline,
    updateServiceWorker,
    requestNotificationPermission,
    subscribeToPush,
    registerBackgroundSync,
  };
}

export default useServiceWorker;