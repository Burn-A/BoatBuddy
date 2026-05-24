'use client';

/**
 * Tide-station layer binding.
 *
 * Reads the current viewport bbox, fetches stations via the data hook,
 * pushes them into the renderer when the user has toggled the tides
 * layer on (and clears them when off). Click handling routes through
 * the renderer's onFeatureClick.
 */

import { useEffect } from 'react';
import type { MapRenderer } from '@/features/map/renderer';
import type { Bbox } from '@/lib/bbox';
import { useTideStations } from '@/features/weather/tides';

const LAYER_ID = 'tides';

interface UseTideLayerOptions {
  renderer: MapRenderer | null;
  bbox: Bbox | null;
  visible: boolean;
}

export function useTideLayer({ renderer, bbox, visible }: UseTideLayerOptions) {
  const { data: stations } = useTideStations(visible ? bbox : null);

  // Push data into the renderer whenever it changes or visibility toggles on.
  useEffect(() => {
    if (!renderer) return;
    if (!visible) {
      renderer.setLayerVisible(LAYER_ID, false);
      return;
    }
    if (!stations) return;

    renderer.upsertPointLayer(
      LAYER_ID,
      { fill: '#2f8f3f', stroke: '#ffffff', radius: 6 },
      stations.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        properties: { name: s.name, state: s.state, kind: 'tide' },
      })),
    );
    renderer.setLayerVisible(LAYER_ID, true);
  }, [renderer, visible, stations]);
}
