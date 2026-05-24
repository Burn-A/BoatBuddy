/**
 * Map renderer facade.
 *
 * Per ARCHITECTURE.md §2.4, this is the single seam between BoatBuddy
 * and the underlying map library. Everything in features/* that needs
 * to draw on the map goes through this module — not through `mapbox-gl`
 * directly — so we can swap renderers (MapLibre, Leaflet) if Mapbox
 * licensing ever becomes painful.
 */

import mapboxgl, { type Map as MapboxMap, type LngLatLike } from 'mapbox-gl';
import type { LatLng } from '@/lib/geo';

export interface RendererInitOptions {
  container: HTMLDivElement;
  /** Initial center; defaults to a sensible Atlantic-coast view. */
  center?: LatLng;
  zoom?: number;
  /** Public Mapbox access token. */
  accessToken: string;
  /** Mapbox style URL. */
  styleUrl: string;
}

export interface MapRenderer {
  setVesselPosition(fix: { lat: number; lng: number; headingDeg: number | null }): void;
  setCourseUp(enabled: boolean, headingDeg: number | null): void;
  flyTo(target: LatLng, zoom?: number): void;
  destroy(): void;
}

const VESSEL_SOURCE = 'bb-vessel';
const VESSEL_LAYER = 'bb-vessel-layer';

/**
 * Initialize Mapbox GL JS and return a renderer handle.
 *
 * The vessel marker is a small SDF-styled symbol so it can rotate with
 * heading and recolor with map style.
 */
export function createRenderer(opts: RendererInitOptions): MapRenderer {
  mapboxgl.accessToken = opts.accessToken;

  const map: MapboxMap = new mapboxgl.Map({
    container: opts.container,
    style: opts.styleUrl,
    center: opts.center ? [opts.center.lng, opts.center.lat] : [-71.05, 42.36],
    zoom: opts.zoom ?? 11,
    attributionControl: true,
    // Touch-first defaults.
    pitchWithRotate: true,
    dragRotate: true,
  });

  let vesselAdded = false;

  function ensureVesselLayer() {
    if (vesselAdded || !map.isStyleLoaded()) return;
    if (!map.getSource(VESSEL_SOURCE)) {
      map.addSource(VESSEL_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: VESSEL_LAYER,
        type: 'circle',
        source: VESSEL_SOURCE,
        paint: {
          'circle-radius': 8,
          'circle-color': '#0a84ff',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
      vesselAdded = true;
    }
  }

  map.on('style.load', ensureVesselLayer);

  return {
    setVesselPosition({ lat, lng, headingDeg }) {
      const apply = () => {
        ensureVesselLayer();
        const src = map.getSource(VESSEL_SOURCE) as mapboxgl.GeoJSONSource | undefined;
        if (!src) return;
        src.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: { heading: headingDeg ?? 0 },
            },
          ],
        });
      };
      if (map.isStyleLoaded()) apply();
      else map.once('style.load', apply);
    },

    setCourseUp(enabled, headingDeg) {
      if (enabled && headingDeg != null) {
        map.easeTo({ bearing: headingDeg, duration: 400 });
      } else if (!enabled) {
        map.easeTo({ bearing: 0, duration: 400 });
      }
    },

    flyTo(target, zoom) {
      const center: LngLatLike = [target.lng, target.lat];
      map.flyTo({ center, zoom: zoom ?? map.getZoom(), essential: true });
    },

    destroy() {
      map.remove();
    },
  };
}
