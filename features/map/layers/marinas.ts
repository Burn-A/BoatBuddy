'use client';

/**
 * Marina layer binding (FR-030).
 *
 * Distinct symbology (purple) so marinas read as a separate visual
 * class from tide stations (green) and wave buoys (red).
 */

import { useEffect } from 'react';
import type { MapRenderer } from '@/features/map/renderer';
import type { Bbox } from '@/lib/bbox';
import { useMarinas } from '@/features/marinas/marinas';

const LAYER_ID = 'marinas';

interface UseMarinaLayerOptions {
  renderer: MapRenderer | null;
  bbox: Bbox | null;
  visible: boolean;
}

export function useMarinaLayer({ renderer, bbox, visible }: UseMarinaLayerOptions) {
  const { data } = useMarinas(visible ? bbox : null);

  useEffect(() => {
    if (!renderer) return;
    if (!visible) {
      renderer.setLayerVisible(LAYER_ID, false);
      return;
    }
    if (!data) return;

    renderer.upsertPointLayer(
      LAYER_ID,
      { fill: '#7c3aed', stroke: '#ffffff', radius: 7 },
      data.marinas.map((m) => ({
        id: m.id,
        lat: m.lat,
        lng: m.lng,
        properties: { name: m.name, kind: 'marina' },
      })),
    );
    renderer.setLayerVisible(LAYER_ID, true);
  }, [renderer, visible, data]);
}
