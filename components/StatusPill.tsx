'use client';

/**
 * Top-right status pill showing live vessel speed and accuracy.
 *
 * Pulls from the Zustand vessel state and respects the user's chosen
 * speed unit. Renders nothing until the first GPS fix arrives.
 */

import { useUiStore } from '@/lib/store';
import { formatSpeed } from '@/lib/units';

export function StatusPill() {
  const vessel = useUiStore((s) => s.vessel);
  const units = useUiStore((s) => s.units);

  if (!vessel) return null;

  const speed = vessel.speedMps != null ? formatSpeed(vessel.speedMps, units.speed, 1) : '— kn';
  const accuracy = vessel.accuracyM > 25 ? `±${Math.round(vessel.accuracyM)} m` : 'GPS';

  return (
    <div className="pointer-events-none rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow ring-1 ring-black/5">
      <span>{speed}</span>
      <span className="mx-2 text-neutral-300">•</span>
      <span className={vessel.accuracyM > 25 ? 'text-chart-hazard' : 'text-chart-buoyGreen'}>
        {accuracy}
      </span>
    </div>
  );
}
