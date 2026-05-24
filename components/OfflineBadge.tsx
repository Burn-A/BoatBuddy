'use client';

/**
 * Small top-of-screen badge that appears when the browser is offline.
 *
 * Implements the user-facing half of NFR-020 — making it visually
 * obvious when the data shown is potentially stale because we can't
 * reach NOAA or the BFF.
 */

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBadge() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setOnline(navigator.onLine);
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none flex items-center gap-2 rounded-full bg-chart-hazard px-3 py-1.5 text-xs font-medium text-white shadow"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      Offline — showing last-known data
    </div>
  );
}
