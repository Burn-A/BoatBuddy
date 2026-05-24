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
  fill: string;
  stroke?: string;
  radius?: number;
}

export interface LineLayerStyle {
  color: string;
  width?: number;
  /** Optional dasharray, e.g., [2, 2]. */
  dashArray?: number[];
  opacity?: number;
}

export interface PolygonLayerStyle {
  fill: string;
  outline?: string;
  fillOpacity?: number;
}

export type FeatureClickHandler = (layerId: string, feature: PointFeature) => void;
export type BboxHandler = (bbox: Bbox) => void;
export type LongPressHandler = (coords: LatLng) => void;

export interface MapRenderer {
  setVesselPosition(fix: { lat: number; lng: number; headingDeg: number | null }): void;
  setCourseUp(enabled: boolean, headingDeg: number | null): void;
  flyTo(target: LatLng, zoom?: number): void;
  getBbox(): Bbox;
  onBboxChange(handler: BboxHandler): () => void;

  upsertPointLayer(layerId: string, style: PointLayerStyle, features: PointFeature[]): void;
  upsertLineLayer(layerId: string, style: LineLayerStyle, polyline: [number, number][]): void;
  upsertPolygonLayer(
    layerId: string,
    style: PolygonLayerStyle,
    polygon: [number, number][][],
  ): void;
  setLayerVisible(layerId: string, visible: boolean): void;
  removeLayer(layerId: string): void;

  /** Toggle a single waypoint marker. Pass null to remove. */
  setWaypointMarker(coords: LatLng | null): void;

  onFeatureClick(handler: FeatureClickHandler): () => void;
  /** Subscribe to long-press / right-click gestures. */
  onLongPress(handler: LongPressHandler): () => void;

  /**
   * Warm the SW tile cache for a bounding box by panning through it at
   * the current zoom and one level deeper. Resolves when finished;
   * `onProgress` fires after each grid step with a value in [0, 1].
   */
  warmTilesForBbox(
    bbox: Bbox,
    opts?: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
  ): Promise<void>;

  destroy(): void;
}

const VESSEL_SOURCE = 'bb-vessel';
const VESSEL_LAYER = 'bb-vessel-layer';
const MANAGED_PREFIX = 'bb-layer-';
const WAYPOINT_SOURCE = 'bb-waypoint';
const WAYPOINT_LAYER = 'bb-waypoint-layer';

const LONG_PRESS_MS = 550;
const LONG_PRESS_MOVE_TOLERANCE_PX = 8;

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
  let waypointAdded = false;
  const managedLayers = new Set<string>();
  const featureClickHandlers = new Set<FeatureClickHandler>();
  const bboxHandlers = new Set<BboxHandler>();
  const longPressHandlers = new Set<LongPressHandler>();

  function whenStyleReady(cb: () => void) {
    if (map.isStyleLoaded()) cb();
    else map.once('style.load', cb);
  }

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

  function ensureWaypointLayer() {
    if (waypointAdded || !map.isStyleLoaded()) return;
    if (!map.getSource(WAYPOINT_SOURCE)) {
      map.addSource(WAYPOINT_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: WAYPOINT_LAYER,
        type: 'circle',
        source: WAYPOINT_SOURCE,
        paint: {
          'circle-radius': 9,
          'circle-color': '#ff9500',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
      waypointAdded = true;
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

  map.on('style.load', () => {
    ensureVesselLayer();
    ensureWaypointLayer();
  });
  map.on('moveend', emitBbox);
  map.on('load', emitBbox);

  // Feature-click delegation across all managed point/line/polygon layers.
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

  // Long-press / contextmenu wiring. Mapbox exposes 'contextmenu' for
  // right-click on desktop but the touch behavior is inconsistent across
  // browsers, so we attach our own touch-and-hold detector to the canvas.
  map.on('contextmenu', (e) => {
    const { lng, lat } = e.lngLat;
    longPressHandlers.forEach((h) => h({ lat, lng }));
  });

  const canvas = map.getCanvasContainer();
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressStart: { x: number; y: number } | null = null;

  function cancelPress() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    pressStart = null;
  }

  const onTouchStart = (ev: TouchEvent) => {
    if (ev.touches.length !== 1) return;
    const t = ev.touches[0];
    pressStart = { x: t.clientX, y: t.clientY };
    pressTimer = setTimeout(() => {
      if (!pressStart) return;
      const rect = canvas.getBoundingClientRect();
      const px: [number, number] = [pressStart.x - rect.left, pressStart.y - rect.top];
      const lngLat = map.unproject(px);
      longPressHandlers.forEach((h) => h({ lat: lngLat.lat, lng: lngLat.lng }));
      cancelPress();
    }, LONG_PRESS_MS);
  };
  const onTouchMove = (ev: TouchEvent) => {
    if (!pressStart || ev.touches.length !== 1) return;
    const t = ev.touches[0];
    const dx = t.clientX - pressStart.x;
    const dy = t.clientY - pressStart.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) cancelPress();
  };
  const onTouchEnd = () => cancelPress();
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);

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

    upsertLineLayer(layerId, style, polyline) {
      const mapboxLayerId = `${MANAGED_PREFIX}${layerId}`;
      const sourceId = `${MANAGED_PREFIX}src-${layerId}`;

      whenStyleReady(() => {
        const geojson = {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: polyline },
          properties: {},
        };

        const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
        if (existing) {
          existing.setData(geojson);
          return;
        }

        map.addSource(sourceId, { type: 'geojson', data: geojson });
        map.addLayer({
          id: mapboxLayerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': style.color,
            'line-width': style.width ?? 4,
            'line-opacity': style.opacity ?? 0.9,
            ...(style.dashArray ? { 'line-dasharray': style.dashArray } : {}),
          },
        });
      });
    },

    upsertPolygonLayer(layerId, style, polygon) {
      const mapboxLayerId = `${MANAGED_PREFIX}${layerId}`;
      const outlineLayerId = `${mapboxLayerId}-outline`;
      const sourceId = `${MANAGED_PREFIX}src-${layerId}`;

      whenStyleReady(() => {
        const geojson = {
          type: 'Feature' as const,
          geometry: { type: 'Polygon' as const, coordinates: polygon },
          properties: {},
        };

        const existing = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
        if (existing) {
          existing.setData(geojson);
          return;
        }

        map.addSource(sourceId, { type: 'geojson', data: geojson });
        map.addLayer({
          id: mapboxLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': style.fill,
            'fill-opacity': style.fillOpacity ?? 0.12,
          },
        });
        if (style.outline) {
          map.addLayer({
            id: outlineLayerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': style.outline,
              'line-width': 1.5,
              'line-dasharray': [2, 2],
            },
          });
        }
      });
    },

    setLayerVisible(layerId, visible) {
      const mapboxLayerId = `${MANAGED_PREFIX}${layerId}`;
      const outlineLayerId = `${mapboxLayerId}-outline`;
      whenStyleReady(() => {
        if (map.getLayer(mapboxLayerId)) {
          map.setLayoutProperty(mapboxLayerId, 'visibility', visible ? 'visible' : 'none');
        }
        if (map.getLayer(outlineLayerId)) {
          map.setLayoutProperty(outlineLayerId, 'visibility', visible ? 'visible' : 'none');
        }
      });
    },

    removeLayer(layerId) {
      const mapboxLayerId = `${MANAGED_PREFIX}${layerId}`;
      const outlineLayerId = `${mapboxLayerId}-outline`;
      const sourceId = `${MANAGED_PREFIX}src-${layerId}`;
      whenStyleReady(() => {
        if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
        if (map.getLayer(mapboxLayerId)) map.removeLayer(mapboxLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        managedLayers.delete(mapboxLayerId);
      });
    },

    setWaypointMarker(coords) {
      whenStyleReady(() => {
        ensureWaypointLayer();
        const src = map.getSource(WAYPOINT_SOURCE) as mapboxgl.GeoJSONSource | undefined;
        if (!src) return;
        src.setData(
          coords
            ? {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
                    properties: {},
                  },
                ],
              }
            : { type: 'FeatureCollection', features: [] },
        );
      });
    },

    onFeatureClick(handler) {
      featureClickHandlers.add(handler);
      return () => {
        featureClickHandlers.delete(handler);
      };
    },

    onLongPress(handler) {
      longPressHandlers.add(handler);
      return () => {
        longPressHandlers.delete(handler);
      };
    },

    async warmTilesForBbox(bbox, opts) {
      const startCenter = map.getCenter();
      const startZoom = map.getZoom();
      const baseZoom = Math.max(8, Math.min(15, Math.floor(startZoom)));
      const zooms = [baseZoom, Math.min(15, baseZoom + 1)];
      const STEPS = 4; // 4x4 grid per zoom level
      const totalSteps = zooms.length * STEPS * STEPS;
      let done = 0;

      const waitIdle = () =>
        Promise.race([
          new Promise<void>((resolve) => map.once('idle', () => resolve())),
          new Promise<void>((resolve) => setTimeout(resolve, 4000)),
        ]);

      try {
        for (const zoom of zooms) {
          for (let i = 0; i < STEPS; i++) {
            for (let j = 0; j < STEPS; j++) {
              if (opts?.signal?.aborted) throw new Error('aborted');
              const lng = bbox.west + ((bbox.east - bbox.west) * (i + 0.5)) / STEPS;
              const lat = bbox.south + ((bbox.north - bbox.south) * (j + 0.5)) / STEPS;
              map.jumpTo({ center: [lng, lat], zoom });
              await waitIdle();
              done++;
              opts?.onProgress?.(done / totalSteps);
            }
          }
        }
      } finally {
        // Restore the original view regardless of how we exit.
        map.jumpTo({ center: startCenter, zoom: startZoom });
      }
    },

    destroy() {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      cancelPress();
      map.remove();
    },
  };
}
