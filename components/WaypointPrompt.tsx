'use client';

/**
 * Confirmation banner shown when a long-press drops a waypoint (FR-006).
 *
 * Sits just under the search bar, non-modal. Shows the dropped lat/lon,
 * distance from the vessel (when GPS is available), and Route here /
 * Cancel actions.
 */

import { MapPin, X } from 'lucide-react';
import { useUiStore } from '@/lib/store';
import { greatCircleDistance } from '@/lib/geo';
import { fromMeters } from '@/lib/units';

function formatCoord(value: number, axis: 'lat' | 'lng'): string {
  const hemi = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${Math.abs(value).toFixed(4)}° ${hemi}`;
}

export function WaypointPrompt() {
  const waypoint = useUiStore((s) => s.ephemeralWaypoint);
  const vessel = useUiStore((s) => s.vessel);
  const distanceUnit = useUiStore((s) => s.units.distance);
  const setEphemeralWaypoint = useUiStore((s) => s.setEphemeralWaypoint);
  const setDestination = useUiStore((s) => s.setDestination);

  if (!waypoint) return null;

  const distanceMeters = vessel
    ? greatCircleDistance({ lat: vessel.lat, lng: vessel.lng }, waypoint)
    : null;
  const distanceLabel =
    distanceMeters != null
      ? `${fromMeters(distanceMeters, distanceUnit).toFixed(1)} ${distanceUnit} away`
      : 'Distance pending GPS fix';

  function confirm() {
    setDestination(waypoint);
    setEphemeralWaypoint(null);
  }

  function cancel() {
    setEphemeralWaypoint(null);
  }

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-white p-3 shadow-md ring-1 ring-black/5">
      <MapPin className="h-5 w-5 text-chart-hazard" aria-hidden />
      <div className="flex-1 leading-tight">
        <p className="text-sm font-medium">Waypoint dropped</p>
        <p className="text-xs text-neutral-500">
          {formatCoord(waypoint.lat, 'lat')} · {formatCoord(waypoint.lng, 'lng')}
        </p>
        <p className="text-xs text-neutral-500">{distanceLabel}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={confirm}
          className="rounded-lg bg-chart-route px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Route here
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label="Cancel waypoint"
          className="grid min-h-touch min-w-touch place-items-center rounded-full text-neutral-500 hover:bg-surface-muted"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
