'use client';

/**
 * Fuel-range ring binding (FR-025).
 *
 * Draws a circular polygon around the vessel sized to the active boat's
 * reserve-adjusted range. The polygon recomputes when the vessel moves,
 * the active boat changes, or its current fuel changes. Only mounted
 * when the user has toggled the 'range' layer on.
 */

import { useEffect, useMemo } from 'react';
import type { MapRenderer } from '@/features/map/renderer';
import { useUiStore } from '@/lib/store';
import { useActiveBoat } from '@/features/boat/profile';
import { buildRangePolygon } from '@/features/navigation/route';
import { estimateRange } from '@/features/boat/fuelRange';

const LAYER_ID = 'range';

interface UseRangeRingLayerOptions {
  renderer: MapRenderer | null;
}

export function useRangeRingLayer({ renderer }: UseRangeRingLayerOptions) {
  const visible = useUiStore((s) => s.layers.range);
  const vessel = useUiStore((s) => s.vessel);
  const activeBoat = useActiveBoat();

  const polygon = useMemo<[number, number][][] | null>(() => {
    if (!vessel || !activeBoat) return null;
    const est = estimateRange(activeBoat);
    if (est.meters <= 0) return null;
    return buildRangePolygon({ lat: vessel.lat, lng: vessel.lng }, est.meters);
  }, [vessel, activeBoat]);

  useEffect(() => {
    if (!renderer) return;
    if (!visible || !polygon) {
      renderer.removeLayer(LAYER_ID);
      return;
    }
    renderer.upsertPolygonLayer(
      LAYER_ID,
      { fill: '#0a84ff', outline: '#0a84ff', fillOpacity: 0.08 },
      polygon,
    );
    renderer.setLayerVisible(LAYER_ID, true);
  }, [renderer, polygon, visible]);
}
