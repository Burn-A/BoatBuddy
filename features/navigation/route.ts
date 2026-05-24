/**
 * Route construction (FR-007).
 *
 * Pure geometry — no React, no map library. Given a start and an end,
 * produces a great-circle polyline along the sphere plus a summary
 * (distance, initial bearing).
 *
 * For typical recreational boating distances (<200 nm) the great circle
 * is visually indistinguishable from a rhumb line on a Mercator map,
 * but we interpolate anyway so the line behaves correctly at any zoom
 * level and during longer trips.
 */

import { greatCircleDistance, initialBearing, type LatLng } from '@/lib/geo';

export interface RouteSummary {
  from: LatLng;
  to: LatLng;
  /** Total length, meters. */
  distanceMeters: number;
  /** Initial bearing from start, degrees true. */
  bearingDeg: number;
  /** Polyline as [lng, lat] pairs for direct Mapbox consumption. */
  polyline: [number, number][];
}

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Spherical linear interpolation between two LatLng points along the
 * great circle. `f` ∈ [0, 1].
 */
function slerp(a: LatLng, b: LatLng, f: number): LatLng {
  const φ1 = toRad(a.lat);
  const λ1 = toRad(a.lng);
  const φ2 = toRad(b.lat);
  const λ2 = toRad(b.lng);

  const sinHalfΔφ = Math.sin((φ2 - φ1) / 2);
  const sinHalfΔλ = Math.sin((λ2 - λ1) / 2);
  const A = sinHalfΔφ * sinHalfΔφ + Math.cos(φ1) * Math.cos(φ2) * sinHalfΔλ * sinHalfΔλ;
  const δ = 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));

  if (δ === 0) return { lat: a.lat, lng: a.lng };

  const k1 = Math.sin((1 - f) * δ) / Math.sin(δ);
  const k2 = Math.sin(f * δ) / Math.sin(δ);

  const x = k1 * Math.cos(φ1) * Math.cos(λ1) + k2 * Math.cos(φ2) * Math.cos(λ2);
  const y = k1 * Math.cos(φ1) * Math.sin(λ1) + k2 * Math.cos(φ2) * Math.sin(λ2);
  const z = k1 * Math.sin(φ1) + k2 * Math.sin(φ2);

  const φ3 = Math.atan2(z, Math.sqrt(x * x + y * y));
  const λ3 = Math.atan2(y, x);
  return { lat: toDeg(φ3), lng: toDeg(λ3) };
}

/**
 * Build a polyline of the great circle from `from` to `to`. The number
 * of segments scales with distance — short hops don't need 64 points.
 */
function buildPolyline(from: LatLng, to: LatLng, distanceMeters: number): [number, number][] {
  // ~1 point per nautical mile, clamped to [2, 64].
  const segments = Math.max(2, Math.min(64, Math.round(distanceMeters / 1852)));
  const out: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const p = slerp(from, to, i / segments);
    out.push([p.lng, p.lat]);
  }
  return out;
}

export function buildRoute(from: LatLng, to: LatLng): RouteSummary {
  const distanceMeters = greatCircleDistance(from, to);
  const bearingDeg = initialBearing(from, to);
  const polyline = buildPolyline(from, to, distanceMeters);
  return { from, to, distanceMeters, bearingDeg, polyline };
}

/**
 * Generate a circular ring polygon around a center, with `radiusMeters`
 * radius. Used for the fuel-range overlay (FR-025).
 *
 * Returns a single Mapbox-friendly polygon: [[ring]] where `ring` is a
 * closed list of [lng, lat] pairs.
 */
export function buildRangePolygon(
  center: LatLng,
  radiusMeters: number,
  segments = 64,
): [number, number][][] {
  if (radiusMeters <= 0) return [[]];
  const φ1 = toRad(center.lat);
  const λ1 = toRad(center.lng);
  const d = radiusMeters / EARTH_RADIUS_M;
  const ring: [number, number][] = [];

  for (let i = 0; i <= segments; i++) {
    const brng = (i * 2 * Math.PI) / segments;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(brng));
    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(φ1),
        Math.cos(d) - Math.sin(φ1) * Math.sin(φ2),
      );
    ring.push([toDeg(λ2), toDeg(φ2)]);
  }
  return [ring];
}
