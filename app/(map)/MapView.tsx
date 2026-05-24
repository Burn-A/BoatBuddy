'use client';

/**
 * MapView — the primary interactive surface for BoatBuddy.
 *
 * Responsibilities (M2):
 *   1. Mount the Mapbox renderer into a full-bleed container.
 *   2. Start the geolocation watcher and push fixes to the Zustand store.
 *   3. Mirror vessel position into the renderer.
 *   4. React to the course-up toggle.
 *   5. Host the UI chrome (search bar, side menu, FAB, compass, status).
 *
 * What this component intentionally does NOT do:
 *   - Fetch tide/wave/marina data (M4).
 *   - Compute routes or ETA (M5).
 *   - Cache tiles for offline (M7).
 */

import { useEffect, useRef } from 'react';
import { createRenderer, type MapRenderer } from '@/features/map/renderer';
import { startVesselWatcher, type VesselWatcher } from '@/features/navigation/vessel';
import { hydrateBoatLibrary } from '@/features/boat/profile';
import { useUiStore } from '@/lib/store';
import { SearchBar } from '@/components/SearchBar';
import { SideMenu } from '@/components/SideMenu';
import { LayerFab } from '@/components/LayerFab';
import { CompassButton } from '@/components/CompassButton';
import { StatusPill } from '@/components/StatusPill';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const MAPBOX_STYLE =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? 'mapbox://styles/mapbox/outdoors-v12';

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const watcherRef = useRef<VesselWatcher | null>(null);

  const vessel = useUiStore((s) => s.vessel);
  const courseUp = useUiStore((s) => s.courseUp);
  const setVessel = useUiStore((s) => s.setVessel);

  // Initialize renderer + vessel watcher exactly once.
  useEffect(() => {
    if (!containerRef.current || rendererRef.current) return;

    if (!MAPBOX_TOKEN) {
      // Surface a developer-friendly hint without crashing the route.
      // eslint-disable-next-line no-console
      console.warn(
        '[BoatBuddy] NEXT_PUBLIC_MAPBOX_TOKEN is not set. Add it to .env.local — see .env.example.',
      );
    }

    rendererRef.current = createRenderer({
      container: containerRef.current,
      accessToken: MAPBOX_TOKEN,
      styleUrl: MAPBOX_STYLE,
    });

    // Pull boat library out of IndexedDB so the side menu and any
    // downstream ETA computations have a boat to work with (FR-040).
    void hydrateBoatLibrary();

    watcherRef.current = startVesselWatcher({
      onFix: (fix) => setVessel(fix),
      onError: (err) => {
        // eslint-disable-next-line no-console
        console.warn('[BoatBuddy] Geolocation error:', err.message);
      },
    });

    return () => {
      watcherRef.current?.stop();
      watcherRef.current = null;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
    // setVessel is a stable zustand setter; safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push vessel fixes into the renderer.
  useEffect(() => {
    if (!vessel || !rendererRef.current) return;
    rendererRef.current.setVesselPosition({
      lat: vessel.lat,
      lng: vessel.lng,
      headingDeg: vessel.headingDeg,
    });
  }, [vessel]);

  // Reflect course-up toggle in the renderer.
  useEffect(() => {
    rendererRef.current?.setCourseUp(courseUp, vessel?.headingDeg ?? null);
  }, [courseUp, vessel?.headingDeg]);

  return (
    <>
      {/* Map canvas */}
      <div ref={containerRef} className="absolute inset-0" aria-label="Marine map" />

      {/* Top chrome: search bar (FR-052) + status pill */}
      <div className="pointer-events-none absolute inset-x-0 top-[env(safe-area-inset-top)] z-20 flex items-start gap-2 p-3">
        <SearchBar className="flex-1" />
        <StatusPill />
      </div>

      {/* Right-side stacked controls: compass + layer FAB (FR-053) */}
      <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-20 flex flex-col items-end gap-3">
        <CompassButton />
        <LayerFab />
      </div>

      {/* Side menu (FR-050) */}
      <SideMenu />
    </>
  );
}
