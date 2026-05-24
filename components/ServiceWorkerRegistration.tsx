'use client';

/**
 * Registers the service worker after the page becomes interactive.
 *
 * Mounted from `app/layout.tsx`. Registration runs once per tab and is
 * idempotent; the SW itself handles versioning.
 */

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Defer to avoid contending with first paint / hydration.
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[BoatBuddy] Service worker registration failed:', err);
      });
    }, 800);

    return () => window.clearTimeout(id);
  }, []);

  return null;
}
