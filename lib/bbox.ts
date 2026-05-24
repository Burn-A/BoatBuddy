/**
 * Bounding box helpers shared between BFF and client.
 *
 * Format on the wire: `west,south,east,north` in decimal degrees.
 */

export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function parseBbox(raw: string | null): Bbox | null {
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) return null;
  return { west, south, east, north };
}

export function formatBbox(b: Bbox): string {
  return `${b.west},${b.south},${b.east},${b.north}`;
}

/** Quantize a bbox to ~0.1° so minor pan jitter shares a cache key. */
export function quantizeBbox(b: Bbox, step = 0.1): Bbox {
  const q = (v: number) => Math.round(v / step) * step;
  return { west: q(b.west), south: q(b.south), east: q(b.east), north: q(b.north) };
}
