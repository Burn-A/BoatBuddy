/**
 * Vessel position watcher.
 *
 * Wraps the browser Geolocation API and emits typed VesselFix updates
 * into the Zustand store. Per FR-002 the watcher handles missing GPS
 * accuracy gracefully and exposes a single start/stop lifecycle.
 */

import type { VesselFix } from '@/lib/store';

export interface VesselWatcher {
  stop: () => void;
}

export interface VesselWatcherOptions {
  onFix: (fix: VesselFix) => void;
  onError?: (err: GeolocationPositionError) => void;
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 2000,
  timeout: 15000,
};

export function startVesselWatcher(opts: VesselWatcherOptions): VesselWatcher | null {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return null;
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
      opts.onFix({
        lat: latitude,
        lng: longitude,
        accuracyM: accuracy,
        headingDeg: Number.isFinite(heading as number) ? (heading as number) : null,
        speedMps: Number.isFinite(speed as number) ? (speed as number) : null,
        timestamp: pos.timestamp,
      });
    },
    (err) => {
      opts.onError?.(err);
    },
    GEO_OPTIONS,
  );

  return {
    stop: () => navigator.geolocation.clearWatch(id),
  };
}
