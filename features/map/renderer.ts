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
import type { Bbox } from '@/lib/bbox';

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

export interface PointFeature {
  id: string;
  lat: number;
  lng: number;
  /** Arbitrary metadata carried through to click handlers. */
  properties?: Record<string, unknown>;
}

export interface PointLayerStyle {
  /** CSS color or expression-friendly string. */
  fill: string;
  stroke?: string;
  radius?: number;
}

export type FeatureClickHandler = (layerId: string, feature: PointFeature) => void;

export type BboxHandler = (bbox: Bbox) => void;

export interface MapRenderer {
  setVesselPosition(fix: { lat: number; lng: number; headingDeg: number | null }): void;
  setCourseUp(enabled: boolean, headingDeg: number | null): void;
  flyTo(target: LatLng, zoom?: number): void;
  /** Get the current map viewport as a bbox. */
  getBbox(): Bbox;
  /** Subscribe to viewport changes (debounced on move-end). */
  onBboxChange(handler: BboxHandler): () => void;
  /** Add or replace a layer of point features. */
  upsertPointLayer(layerId: string, style: PointLayerStyle, features: PointFeature[]): void;
  /** Show/hide an existing layer without dropping its data. */
  setLayerVisible(layerId: string, visible: boolean): void;
  /** Remove a layer and its source. */
  removeLayer(layerId: string): void;
  /** Subscribe to clicks on managed point layers. */
  onFeatureClick(handler: FeatureClickHandler): () => void;
  destroy(): void;
}

const VESSEL_SOURCE = 'bb-vessel';
const VESSEL_LAYER = 'bb-vessel-layer';
const MANAGED_PREFIX = 'bb-layer-';

export function createRenderer(opts: RendererInitOptions): MapRenderer {
  mapboxgl.accessToken = opts.accessToken;

  const map: MapboxMap = new mapboxgl.Map({
    container: opts.container,
    style: opts.styleUrl,
    center: opts.center ? [opts.center.lng, opts.center.lat] : [-71.05, 42.36],
    zoom: opts.zoom ?? 11,
    attributionControl: true,
    pitchWithRotate: true,
    dragRotate: true,
  });

  let vesselAdded = false;
  const managedLayers = new Set<string>();
  const featureClickHandlers = new Set<FeatureClickHandler>();
  const bboxHandlers = new Set<BboxHandler>();

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

  function emitBbox() {
    const b = map.getBounds();
    if (!b) return;
    const bbox: Bbox = {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    };
    bboxHandlers.forEach((h) => h(bbox));
  }

  map.on('style.load', ensureVesselLayer);
  map.on('moveend', emitBbox);
  map.on('load', emitBbox);

  // Click delegation: any click that hits a managed layer routes to handlers.
  map.on('click', (e) => {
    if (managedLayers.size === 0) return;
    const features = map.queryRenderedFeatures(e.point, {
      layers: Array.from(managedLayers),
    });
    if (features.length === 0) return;
    const f = features[0];
    const geom = f.geometry;
    if (geom.type !== 'Point') return;
    const [lng, lat] = geom.coordinates;
    const point: PointFeature = {
      id: String(f.properties?.id ?? f.id ?? ''),
      lat,
      lng,
      properties: f.properties ?? {},
    };
    featureClickHandlers.forEach((h) => h(f.layer.id.replace(MANAGED_PREFIX, ''), point));
  });

  function whenStyleReady(cb: () => void) {
    if (map.isStyleLoaded()) cb();
    else map.once('style.load', cb);
  }

  return {
    setVesselPosition({ lat, lng, headingDeg }) {
      whenStyleReady(() => {
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
      });
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

    getBbox() {
      const b = map.getBounds();
      return b
        ? { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }
        : { west: -180, south: -90, east: 180, north: 90 };
    },

    onBboxChange(handler) {
      bboxHandlers.add(handler);
      return () => {
        bboxHandlers.delete(handler);
      };
    },

    upsertPointLayer(layerId, style, features) {
      const mapboxLayerId = `${MANAGED_PREFIX}${layerId}`;
      const sourceId = `${MANAGED_PREFIX}src-${layerId}`;

      whenStyleReady(() => {
        const geojson = {
          type: 'FeatureCollection' as const,
          features: features.map((f) => ({
            type: 'Feature' as const,
            id: f.id,
            geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
            properties: { id: f.id, ...(f.properties ?? {}) },
          })),
        };

        const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
        if (existing) {
          existing.setData(geojson);
          return;
        }

        map.addSource(sourceId, { type: 'geojson', data: geojson });
        map.addLayer({
          id: mapboxLayerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': style.radius ?? 6,
            'circle-color': style.fill,
            'circle-stroke-color': style.stroke ?? '#ffffff',
            'circle-stroke-width': 2,
          },
        });
        managedLayers.add(mapboxLayerId);
      });
    },

    setLayerVisible(layerId, visible) {
      const mapboxLayerId = `${MANAGED_PREFIX}${layerId}`;
      whenStyleReady(() => {
        if (!map.getLayer(mapboxLayerId)) return;
        map.setLayoutProperty(mapboxLayerId, 'visibility', visible ? 'visible' : 'none');
      });
    },

    removeLayer(layerId) {
      const mapboxLayerId = `${MANAGED_PREFIX}${layerId}`;
      const sourceId = `${MANAGED_PREFIX}src-${layerId}`;
      whenStyleReady(() => {
        if (map.getLayer(mapboxLayerId)) map.removeLayer(mapboxLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        managedLayers.delete(mapboxLayerId);
      });
    },

    onFeatureClick(handler) {
      featureClickHandlers.add(handler);
      return () => {
        featureClickHandlers.delete(handler);
      };
    },

    destroy() {
      map.remove();
    },
  };
}
