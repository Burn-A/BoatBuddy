'use client';

/**
 * "Save current view for offline" action (FR-042).
 *
 * Tells the renderer to traverse the current bbox at the current zoom
 * (and one deeper), which forces tile fetches that the service worker
 * picks up into its tile cache. Progress is reported back from the
 * renderer via the onProgress callback.
 */

import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import { useRenderer } from '@/features/map/RendererContext';
import { useUiStore } from '@/lib/store';

type Status = 'idle' | 'saving' | 'done' | 'error';

export function SaveOfflineButton() {
  const renderer = useRenderer();
  const bbox = useUiStore((s) => s.bbox);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);

  const disabled = !renderer || !bbox || status === 'saving';

  async function save() {
    if (!renderer || !bbox) return;
    setStatus('saving');
    setProgress(0);
    try {
      await renderer.warmTilesForBbox(bbox, {
        onProgress: (f) => setProgress(f),
      });
      setStatus('done');
      // Auto-reset so the button is usable again later.
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[BoatBuddy] Tile warm failed:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={disabled}
      className="flex min-h-touch w-full items-center justify-between rounded-lg bg-surface-muted px-3 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
      aria-label="Save current map view for offline use"
    >
      <span className="flex items-center gap-2">
        {status === 'done' ? (
          <Check className="h-4 w-4 text-chart-buoyGreen" aria-hidden />
        ) : (
          <Download className="h-4 w-4" aria-hidden />
        )}
        {status === 'idle' && 'Save current view offline'}
        {status === 'saving' && `Saving… ${Math.round(progress * 100)}%`}
        {status === 'done' && 'Saved for offline'}
        {status === 'error' && 'Save failed — try again'}
      </span>
    </button>
  );
}
