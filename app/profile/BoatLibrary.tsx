'use client';

/**
 * Interactive boat library — lists profiles, expands an editor inline,
 * and lets the user add from seed or create custom.
 *
 * Drives FR-021, FR-023, FR-024, and the "set active" interaction
 * across the app via the Zustand store.
 */

import { useEffect, useState } from 'react';
import { Anchor, Plus, Star, StarOff, Sparkles } from 'lucide-react';
import { useUiStore } from '@/lib/store';
import {
  hydrateBoatLibrary,
  setActiveBoat,
  createCustom,
} from '@/features/boat/profile';
import { estimateRange } from '@/features/boat/fuelRange';
import { BoatEditor } from '@/components/BoatEditor';
import { SeedPicker } from '@/components/SeedPicker';
import { fromMeters } from '@/lib/units';
import { cn } from '@/lib/cn';
import type { BoatProfile } from '@/features/boat/types';

export function BoatLibrary() {
  const boats = useUiStore((s) => s.boats);
  const activeBoatId = useUiStore((s) => s.activeBoatId);
  const hydrated = useUiStore((s) => s.hydrated);
  const distanceUnit = useUiStore((s) => s.units.distance);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Hydration also runs from MapView; double-calling is a no-op thanks
  // to the guard inside hydrateBoatLibrary. We call from here too so
  // /profile works even if the user lands here without visiting the map first.
  useEffect(() => {
    void hydrateBoatLibrary();
  }, []);

  async function addCustom() {
    const profile = await createCustom({ displayName: 'My boat' });
    setExpandedId(profile.uuid);
  }

  if (!hydrated) {
    return <p className="px-2 py-6 text-sm text-neutral-500">Loading your boats…</p>;
  }

  return (
    <>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-chart-route px-3 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" aria-hidden /> Add from catalog
        </button>
        <button
          type="button"
          onClick={addCustom}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-neutral-700 ring-1 ring-black/10 hover:bg-surface-muted"
        >
          <Plus className="h-4 w-4" aria-hidden /> Custom
        </button>
      </div>

      {boats.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {boats.map((b) => (
            <BoatRow
              key={b.uuid}
              boat={b}
              active={b.uuid === activeBoatId}
              expanded={expandedId === b.uuid}
              onToggle={() => setExpandedId((id) => (id === b.uuid ? null : b.uuid))}
              onSetActive={() => void setActiveBoat(b.uuid)}
              onDeleted={() => setExpandedId(null)}
              distanceUnit={distanceUnit}
            />
          ))}
        </ul>
      )}

      <SeedPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPicked={(uuid) => setExpandedId(uuid)}
      />
    </>
  );
}

/* ─────────── child rows ─────────── */

interface RowProps {
  boat: BoatProfile;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSetActive: () => void;
  onDeleted: () => void;
  distanceUnit: 'nm' | 'mi' | 'km';
}

function BoatRow({
  boat,
  active,
  expanded,
  onToggle,
  onSetActive,
  onDeleted,
  distanceUnit,
}: RowProps) {
  const range = estimateRange(boat);
  const rangeLabel =
    range.meters > 0 ? `${fromMeters(range.meters, distanceUnit).toFixed(0)} ${distanceUnit}` : '—';

  return (
    <li
      className={cn(
        'rounded-xl bg-white shadow-sm ring-1 transition-shadow',
        active ? 'ring-chart-route' : 'ring-black/5',
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <Anchor
          className={cn('h-5 w-5', active ? 'text-chart-route' : 'text-neutral-400')}
          aria-hidden
        />
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 flex-col text-left"
          aria-expanded={expanded}
        >
          <span className="text-sm font-medium">
            {boat.displayName}
            {active && (
              <span className="ml-2 rounded-full bg-chart-route/10 px-2 py-0.5 text-xs font-medium text-chart-route">
                Active
              </span>
            )}
          </span>
          <span className="text-xs text-neutral-500">
            {boat.loaFt.toFixed(1)} ft &middot; cruise {boat.cruiseSpeedKn} kn &middot; range ≈{' '}
            {rangeLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={onSetActive}
          aria-label={active ? 'Already active' : 'Set as active boat'}
          disabled={active}
          className={cn(
            'grid min-h-touch min-w-touch place-items-center rounded-full',
            active ? 'text-chart-route' : 'text-neutral-400 hover:bg-surface-muted',
          )}
        >
          {active ? (
            <Star className="h-5 w-5 fill-current" aria-hidden />
          ) : (
            <StarOff className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-black/5 p-3">
          <BoatEditor boat={boat} onDeleted={onDeleted} />
        </div>
      )}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-black/10 p-6 text-center">
      <p className="text-sm text-neutral-600">
        No boats yet. Add one from the catalog or create a custom profile.
      </p>
    </div>
  );
}
