'use client';

/**
 * Searchable picker over the seed database (FR-022).
 *
 * Renders as a bottom sheet on mobile / centered dialog on wider
 * screens. Selecting a seed creates a new BoatProfile via the profile
 * module and closes.
 */

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { searchSeeds, SEED_DISCLAIMER } from '@/features/boat/seedDb';
import { createFromSeed } from '@/features/boat/profile';
import type { BoatSeed, Category } from '@/features/boat/types';
import { cn } from '@/lib/cn';

interface SeedPickerProps {
  open: boolean;
  onClose: () => void;
  onPicked?: (uuid: string) => void;
}

const CATEGORY_LABELS: Record<Category, string> = {
  'center-console': 'Center console',
  cruiser: 'Cruiser',
  bowrider: 'Bowrider',
  pontoon: 'Pontoon',
  sailboat: 'Sailboat',
  trawler: 'Trawler',
  jet: 'Jet',
  other: 'Other',
};

const FILTERS: (Category | 'all')[] = [
  'all',
  'center-console',
  'cruiser',
  'bowrider',
  'pontoon',
  'sailboat',
  'trawler',
  'jet',
];

export function SeedPicker({ open, onClose, onPicked }: SeedPickerProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const results = useMemo(
    () => searchSeeds(query, filter === 'all' ? undefined : filter),
    [query, filter],
  );

  async function pick(seed: BoatSeed) {
    setBusyId(seed.id);
    try {
      const profile = await createFromSeed(seed.id);
      onPicked?.(profile.uuid);
      onClose();
    } finally {
      setBusyId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a boat from the seed database"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div className="flex h-[85vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-2xl sm:h-[80vh] sm:rounded-2xl">
        <header className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
          <Search className="h-4 w-4 text-neutral-500" aria-hidden />
          <input
            autoFocus
            type="search"
            placeholder="Search make or model"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-500"
          />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid min-h-touch min-w-touch place-items-center rounded-full hover:bg-surface-muted"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-black/5 px-3 py-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1 text-xs',
                filter === f
                  ? 'bg-chart-route text-white'
                  : 'bg-surface-muted text-neutral-600 hover:bg-neutral-200',
              )}
            >
              {f === 'all' ? 'All' : CATEGORY_LABELS[f]}
            </button>
          ))}
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-black/5">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s)}
                disabled={busyId === s.id}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-muted disabled:opacity-50"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-medium">
                    {s.manufacturer} {s.model}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {CATEGORY_LABELS[s.category]} &middot; {s.loaFt.toFixed(1)} ft &middot;{' '}
                    cruise {s.cruiseSpeedKn} kn &middot; {s.fuelBurnGph} gph
                  </span>
                </span>
                <span className="text-xs text-chart-route">
                  {busyId === s.id ? 'Adding…' : 'Add'}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-neutral-500">No matches.</li>
          )}
        </ul>

        <footer className="border-t border-black/5 px-4 py-2 text-xs text-neutral-500">
          {SEED_DISCLAIMER}
        </footer>
      </div>
    </div>
  );
}
