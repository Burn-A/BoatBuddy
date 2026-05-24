'use client';

/**
 * MapView — the primary interactive surface for BoatBuddy.
 *
 * Responsibilities by milestone:
 *   M2: Mapbox renderer, vessel watcher, UI chrome.
 *   M3: hydrate boat library on mount.
 *   M4: track viewport bbox, mount tide + wave data layers, handle
 *       feature taps via a bottom sheet.
*   M5: long-press to drop a waypoint, route line + adaptive ETA,
 *       fuel-range ring.
 *   M6: marina layer with detail cards.
 *   M7: RendererProvider so the side menu can warm tiles; offline badge.
 */

import { useEffect, useRef, useState } from 'react';
import { createRenderer, type MapRenderer } from '@/features/map/renderer';
import { RendererProvider } from '@/features/map/RendererContext';
import { startVesselWatcher, type VesselWatcher } from '@/features/navigation/vessel';
import { hydrateBoatLibrary } from '@/features/boat/profile';
import { useTideLayer } from '@/features/map/layers/tides';
import { useWaveLayer } from '@/features/map/layers/waves';
import { useMarinaLayer } from '@/features/map/layers/marinas';
import { useRouteLayer } from '@/features/map/layers/route';
import { useRangeRingLayer } from '@/features/map/layers/rangeRing';
import { useUiStore } from '@/lib/store';
import { SearchBar } from '@/components/SearchBar';
import { SideMenu } from '@/components/SideMenu';
import { LayerFab } from '@/components/LayerFab';
import { CompassButton } from '@/components/CompassButton';
import { StatusPill } from '@/components/StatusPill';
import { BottomSheet } from '@/components/BottomSheet';
import { FeatureDetail } from '@/components/FeatureDetail';
import { RouteHeader } from '@/components/RouteHeader';
import { WaypointPrompt } from '@/components/WaypointPrompt';
import { OfflineBadge } from '@/components/OfflineBadge';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const MAPBOX_STYLE =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? 'mapbox://styles/mapbox/outdoors-v12';

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const watcherRef = useRef<VesselWatcher | null>(null);

  // Renderer is React state so child hooks re-run when it becomes available.
  const [renderer, setRenderer] = useState<MapRenderer | null>(null);

  const vessel = useUiStore((s) => s.vessel);
  const courseUp = useUiStore((s) => s.courseUp);
  const setVessel = useUiStore((s) => s.setVessel);
  const bbox = useUiStore((s) => s.bbox);
  const setBbox = useUiStore((s) => s.setBbox);
  const layers = useUiStore((s) => s.layers);
  const selectedFeature = useUiStore((s) => s.selectedFeature);
  const setSelectedFeature = useUiStore((s) => s.setSelectedFeature);
  const setEphemeralWaypoint = useUiStore((s) => s.setEphemeralWaypoint);
  const destination = useUiStore((s) => s.destination);
  const ephemeralWaypoint = useUiStore((s) => s.ephemeralWaypoint);

  // Mount the map + watchers once.
  useEffect(() => {
    if (!containerRef.current || renderer) return;

    if (!MAPBOX_TOKEN) {
      // eslint-disable-next-line no-console
      console.warn(
        '[BoatBuddy] NEXT_PUBLIC_MAPBOX_TOKEN is not set. Add it to .env.local — see .env.example.',
      );
    }

    const r = createRenderer({
      container: containerRef.current,
      accessToken: MAPBOX_TOKEN,
      styleUrl: MAPBOX_STYLE,
    });

    const offBbox = r.onBboxChange((b) => setBbox(b));
    const offClick = r.onFeatureClick((_layerId, feature) => {
      const kind =
        (feature.properties?.kind as 'tide' | 'wave' | 'marina' | undefined) ?? null;
      if (!kind) return;
      const name = (feature.properties?.name as string | undefined) ?? feature.id;
      setSelectedFeature({ kind, id: feature.id, name });
    });
    const offLongPress = r.onLongPress((coords) => {
      // FR-006: a long-press drops a candidate waypoint; the user
      // confirms via the WaypointPrompt before it becomes a route.
      setEphemeralWaypoint(coords);
    });

    setRenderer(r);
    void hydrateBoatLibrary();

    watcherRef.current = startVesselWatcher({
      onFix: (fix) => setVessel(fix),
      onError: (err) => {
        // eslint-disable-next-line no-console
        console.warn('[BoatBuddy] Geolocation error:', err.message);
      },
    });

    return () => {
      offBbox();
      offClick();
      offLongPress();
      watcherRef.current?.stop();
      watcherRef.current = null;
      r.destroy();
      setRenderer(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push vessel fixes into the renderer.
  useEffect(() => {
    if (!vessel || !renderer) return;
    renderer.setVesselPosition({
      lat: vessel.lat,
      lng: vessel.lng,
      headingDeg: vessel.headingDeg,
    });
  }, [vessel, renderer]);

  // Reflect course-up toggle in the renderer.
  useEffect(() => {
    renderer?.setCourseUp(courseUp, vessel?.headingDeg ?? null);
  }, [courseUp, vessel?.headingDeg, renderer]);

  // Bind data-driven layers (tide, wave, marina). Each binding handles
  // its own visibility & data lifecycle.
  useTideLayer({ renderer, bbox, visible: layers.tides });
  useWaveLayer({ renderer, bbox, visible: layers.waves });
  useMarinaLayer({ renderer, bbox, visible: layers.marinas });

  // Route + range-ring layers read the vessel/destination/active-boat
  // straight from the store, so they don't need props.
  useRouteLayer({ renderer });
  useRangeRingLayer({ renderer });

  return (
    <RendererProvider renderer={renderer}>
      <div ref={containerRef} className="absolute inset-0" aria-label="Marine map" />

      <div className="pointer-events-none absolute inset-x-0 top-[env(safe-area-inset-top)] z-20 flex flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <SearchBar className="flex-1" />
          <StatusPill />
        </div>
        <div className="flex justify-center">
          <OfflineBadge />
        </div>
        {destination && (
          <div className="flex justify-center">
            <RouteHeader />
          </div>
        )}
        {ephemeralWaypoint && <WaypointPrompt />}
      </div>

      <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-20 flex flex-col items-end gap-3">
        <CompassButton />
        <LayerFab />
      </div>

      <SideMenu />

      <BottomSheet
        open={!!selectedFeature}
        onClose={() => setSelectedFeature(null)}
        title={
          selectedFeature?.kind === 'tide'
            ? 'Tide station'
            : selectedFeature?.kind === 'wave'
              ? 'Wave buoy'
              : selectedFeature?.kind === 'marina'
                ? 'Marina'
                : 'Details'
        }
      >
        {selectedFeature && <FeatureDetail feature={selectedFeature} />}
      </BottomSheet>
    </RendererProvider>
  );
}
