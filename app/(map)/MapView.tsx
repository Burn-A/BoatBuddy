'use client';

/**
 * MapView — the primary interactive surface for BoatBuddy.
 *
 * Responsibilities by milestone:
 *   M2: Mapbox renderer, vessel watcher, UI chrome.
 *   M3: hydrate boat library on mount.
 *   M4: track viewport bbox, mount tide + wave data layers, handle
 *       feature taps via a bottom sheet.
 */

import { useEffect, useRef, useState } from 'react';
import { createRenderer, type MapRenderer } from '@/features/map/renderer';
import { startVesselWatcher, type VesselWatcher } from '@/features/navigation/vessel';
import { hydrateBoatLibrary } from '@/features/boat/profile';
import { useTideLayer } from '@/features/map/layers/tides';
import { useWaveLayer } from '@/features/map/layers/waves';
import { useUiStore } from '@/lib/store';
import { SearchBar } from '@/components/SearchBar';
import { SideMenu } from '@/components/SideMenu';
import { LayerFab } from '@/components/LayerFab';
import { CompassButton } from '@/components/CompassButton';
import { StatusPill } from '@/components/StatusPill';
import { BottomSheet } from '@/components/BottomSheet';
import { FeatureDetail } from '@/components/FeatureDetail';

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
      const kind = (feature.properties?.kind as 'tide' | 'wave' | undefined) ?? null;
      if (!kind) return;
      const name = (feature.properties?.name as string | undefined) ?? feature.id;
      setSelectedFeature({ kind, id: feature.id, name });
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

  // Bind data-driven layers (tide, wave). Each binding handles its own
  // visibility & data lifecycle.
  useTideLayer({ renderer, bbox, visible: layers.tides });
  useWaveLayer({ renderer, bbox, visible: layers.waves });

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" aria-label="Marine map" />

      <div className="pointer-events-none absolute inset-x-0 top-[env(safe-area-inset-top)] z-20 flex items-start gap-2 p-3">
        <SearchBar className="flex-1" />
        <StatusPill />
      </div>

      <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-20 flex flex-col items-end gap-3">
        <CompassButton />
        <LayerFab />
      </div>

      <SideMenu />

      <BottomSheet
        open={!!selectedFeature}
        onClose={() => setSelectedFeature(null)}
        title={selectedFeature?.kind === 'tide' ? 'Tide station' : 'Wave buoy'}
      >
        {selectedFeature && <FeatureDetail feature={selectedFeature} />}
      </BottomSheet>
    </>
  );
}
