'use client';

/**
 * Wave-buoy layer binding (NDBC).
 */

import { useEffect } from 'react';
import type { MapRenderer } from '@/features/map/renderer';
import type { Bbox } from '@/lib/bbox';
import { useWaveStations } from '@/features/weather/waves';

const LAYER_ID = 'waves';

interface UseWaveLayerOptions {
  renderer: MapRenderer | null;
  bbox: Bbox | null;
  visible: boolean;
}

export function useWaveLayer({ renderer, bbox, visible }: UseWaveLayerOptions) {
  const { data: stations } = useWaveStations(visible ? bbox : null);

  useEffect(() => {
    if (!renderer) return;
    if (!visible) {
      renderer.setLayerVisible(LAYER_ID, false);
      return;
    }
    if (!stations) return;

    renderer.upsertPointLayer(
      LAYER_ID,
      { fill: '#d4392b', stroke: '#ffffff', radius: 6 },
      stations.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        properties: { name: s.name, kind: 'wave' },
      })),
    );
    renderer.setLayerVisible(LAYER_ID, true);
  }, [renderer, visible, stations]);
}
