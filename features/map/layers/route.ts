'use client';

/**
 * Route layer binding (FR-007).
 *
 * Subscribes to vessel position + destination + ephemeral waypoint in
 * the Zustand store and pushes the corresponding line and marker into
 * the renderer. When destination is null the layer is removed entirely
 * so it doesn't linger as a faint artifact.
 */

import { useEffect, useMemo } from 'react';
import type { MapRenderer } from '@/features/map/renderer';
import { useUiStore } from '@/lib/store';
import { buildRoute } from '@/features/navigation/route';
import type { LatLng } from '@/lib/geo';

const ROUTE_LAYER_ID = 'route';

interface UseRouteLayerOptions {
  renderer: MapRenderer | null;
}

export function useRouteLayer({ renderer }: UseRouteLayerOptions) {
  const vessel = useUiStore((s) => s.vessel);
  const destination = useUiStore((s) => s.destination);
  const ephemeralWaypoint = useUiStore((s) => s.ephemeralWaypoint);

  // The candidate marker (ephemeral) takes priority over the confirmed
  // destination so the user sees the latest interaction reflected.
  const markerCoords: LatLng | null = ephemeralWaypoint ?? destination ?? null;

  const polyline = useMemo<[number, number][] | null>(() => {
    if (!vessel || !destination) return null;
    const route = buildRoute(
      { lat: vessel.lat, lng: vessel.lng },
      { lat: destination.lat, lng: destination.lng },
    );
    return route.polyline;
  }, [vessel, destination]);

  // Route line
  useEffect(() => {
    if (!renderer) return;
    if (polyline) {
      renderer.upsertLineLayer(
        ROUTE_LAYER_ID,
        { color: '#0a84ff', width: 4, opacity: 0.85 },
        polyline,
      );
      renderer.setLayerVisible(ROUTE_LAYER_ID, true);
    } else {
      renderer.removeLayer(ROUTE_LAYER_ID);
    }
  }, [renderer, polyline]);

  // Waypoint / destination marker
  useEffect(() => {
    if (!renderer) return;
    renderer.setWaypointMarker(markerCoords);
  }, [renderer, markerCoords]);
}
