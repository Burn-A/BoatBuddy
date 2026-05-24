/**
 * Geographic / great-circle helpers.
 *
 * All angles in degrees at the public boundary; radians internally.
 * Distances returned in meters.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Great-circle (haversine) distance between two points in meters.
 */
export function greatCircleDistance(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const dφ = toRad(b.lat - a.lat);
  const dλ = toRad(b.lng - a.lng);

  const x =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return EARTH_RADIUS_M * c;
}

/**
 * Initial bearing in degrees (0–360) from point a to point b.
 * Useful for "course-up" map rotation when underway.
 */
export function initialBearing(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const dλ = toRad(b.lng - a.lng);

  const y = Math.sin(dλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/** Cheap bbox check — useful for "did the camera actually move?" gates. */
export function bboxesEqual(
  a: [number, number, number, number],
  b: [number, number, number, number],
  epsilon = 1e-4,
): boolean {
  return a.every((v, i) => Math.abs(v - b[i]) < epsilon);
}
