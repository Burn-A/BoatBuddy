'use client';

/**
 * Persistent header pill shown when a route is active (FR-007, FR-020).
 *
 * Displays total distance, ETA duration, arrival clock time, and a
 * source badge — "Live" when ETA is derived from current GPS speed,
 * "Cruise" when it's based on the active boat's cruise speed.
 */

import { X } from 'lucide-react';
import { useActiveBoat } from '@/features/boat/profile';
import { computeEta, formatDuration, formatClockTime } from '@/features/navigation/eta';
import { greatCircleDistance } from '@/lib/geo';
import { fromMeters } from '@/lib/units';
import { useUiStore } from '@/lib/store';
import { cn } from '@/lib/cn';

export function RouteHeader() {
  const destination = useUiStore((s) => s.destination);
  const vessel = useUiStore((s) => s.vessel);
  const distanceUnit = useUiStore((s) => s.units.distance);
  const setDestination = useUiStore((s) => s.setDestination);
  const activeBoat = useActiveBoat();

  if (!destination) return null;

  // Distance falls back to "—" if we haven't received a GPS fix yet.
  const distanceMeters = vessel
    ? greatCircleDistance({ lat: vessel.lat, lng: vessel.lng }, destination)
    : null;
  const distanceLabel =
    distanceMeters != null
      ? `${fromMeters(distanceMeters, distanceUnit).toFixed(1)} ${distanceUnit}`
      : '—';

  const eta = distanceMeters
    ? computeEta({
        distanceMeters,
        liveSpeedMps: vessel?.speedMps ?? null,
        cruiseSpeedKn: activeBoat?.cruiseSpeedKn ?? null,
      })
    : null;

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-white px-3 py-2 shadow-md ring-1 ring-black/5">
      <div className="flex flex-col leading-tight">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Route</span>
        <span className="text-sm font-semibold">{distanceLabel}</span>
      </div>

      <div className="mx-1 h-8 w-px bg-black/10" />

      <div className="flex flex-1 flex-col leading-tight">
        <span className="text-xs uppercase tracking-wide text-neutral-500">ETA</span>
        {eta ? (
          <span className="text-sm font-semibold">
            {formatDuration(eta.durationSec)}
            <span className="ml-1.5 font-normal text-neutral-500">
              · {formatClockTime(eta.arrivalEpochMs)}
            </span>
          </span>
        ) : (
          <span className="text-sm text-neutral-500">No speed yet</span>
        )}
      </div>

      {eta && (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            eta.source === 'live'
              ? 'bg-chart-buoyGreen/10 text-chart-buoyGreen'
              : 'bg-chart-route/10 text-chart-route',
          )}
        >
          {eta.source === 'live' ? 'Live' : 'Cruise'}
        </span>
      )}

      <button
        type="button"
        aria-label="Clear route"
        onClick={() => setDestination(null)}
        className="grid min-h-touch min-w-touch place-items-center rounded-full hover:bg-surface-muted"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
