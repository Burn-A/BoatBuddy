'use client';

/**
 * Layer toggle FAB (FR-053).
 *
 * Floating action button bottom-right; click expands a popover listing
 * the optional overlay layers. M2 lets the user toggle the boolean
 * state; the layers themselves are wired in M4.
 */

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { useUiStore, type LayerId } from '@/lib/store';
import { cn } from '@/lib/cn';

const LAYER_DEFS: { id: LayerId; label: string; milestone: string }[] = [
  { id: 'tides', label: 'Tide stations', milestone: 'M4' },
  { id: 'waves', label: 'Wave buoys', milestone: 'M4' },
  { id: 'range', label: 'Fuel range ring', milestone: 'M5' },
  { id: 'aton', label: 'Aids to navigation', milestone: 'M7' },
  { id: 'hazards', label: 'Hazards', milestone: 'M7' },
  { id: 'marinas', label: 'Marinas', milestone: 'M6' },
  { id: 'depth', label: 'Charted depth', milestone: 'M7' },
];

export function LayerFab() {
  const [open, setOpen] = useState(false);
  const layers = useUiStore((s) => s.layers);
  const toggleLayer = useUiStore((s) => s.toggleLayer);

  return (
    <div className="pointer-events-auto relative">
      <button
        type="button"
        aria-label="Map layers"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-md ring-1 ring-black/5 hover:bg-surface-muted"
      >
        <Layers className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Layer toggles"
          className={cn(
            'absolute bottom-14 right-0 w-60 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/5',
          )}
        >
          <ul className="divide-y divide-black/5">
            {LAYER_DEFS.map((l) => (
              <li key={l.id}>
                <label className="flex min-h-touch cursor-pointer items-center justify-between gap-2 px-2 py-2 text-sm">
                  <span className="flex flex-col">
                    <span>{l.label}</span>
                    <span className="text-xs text-neutral-400">{l.milestone}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={layers[l.id]}
                    onChange={() => toggleLayer(l.id)}
                    className="h-5 w-5"
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
