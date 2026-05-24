'use client';

/**
 * Compact active-boat summary used in the side menu and (later) the
 * map header. Shows nothing if no boat is active.
 */

import Link from 'next/link';
import { Anchor, ChevronRight } from 'lucide-react';
import { useActiveBoat } from '@/features/boat/profile';
import { formatSpeed } from '@/lib/units';
import { useUiStore } from '@/lib/store';

export function BoatBadge() {
  const active = useActiveBoat();
  const units = useUiStore((s) => s.units);

  if (!active) {
    return (
      <Link
        href="/profile"
        className="flex min-h-touch items-center justify-between rounded-lg border border-dashed border-black/15 px-3 py-2 text-sm text-neutral-600 hover:bg-surface-muted"
      >
        <span>No boat selected — set one up</span>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    );
  }

  // Cruise speed comes in knots; convert to user pref unless already knots.
  const cruiseMps = active.cruiseSpeedKn / 1.943844;
  const cruise = formatSpeed(cruiseMps, units.speed, 1);

  return (
    <Link
      href="/profile"
      className="flex min-h-touch items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2 text-sm hover:bg-neutral-200"
    >
      <span className="flex items-center gap-2">
        <Anchor className="h-4 w-4 text-chart-route" aria-hidden />
        <span className="flex flex-col">
          <span className="font-medium">{active.displayName}</span>
          <span className="text-xs text-neutral-500">
            {active.loaFt.toFixed(1)} ft &middot; cruise {cruise}
          </span>
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-neutral-400" aria-hidden />
    </Link>
  );
}
