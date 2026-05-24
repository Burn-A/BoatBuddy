/**
 * OSM Overpass marina client.
 *
 * Per ARCHITECTURE.md §5 the v1 marina dataset is sourced from
 * OpenStreetMap via the public Overpass API. Marina entries in OSM are
 * tagged `leisure=marina`; we query both `node` (point marinas) and
 * `way` (polygon marinas, using `out center` for the centroid) inside
 * the requested bbox.
 *
 * The OSM tagging vocabulary is open and inconsistent — most marinas
 * have a `name` and not much else. We extract a curated subset of
 * commonly-used keys and pass everything as nullable so the UI can
 * render "Not listed" honestly.
 *
 * Attribution: data © OpenStreetMap contributors, ODbL.
 */

import { TTL, withTtl } from '@/lib/serverCache';
import { quantizeBbox, type Bbox } from '@/lib/bbox';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export const MARINA_ATTRIBUTION = '© OpenStreetMap contributors';

export interface Marina {
  /** Stable, prefix-tagged id: "node/123" or "way/456". */
  id: string;
  name: string;
  lat: number;
  lng: number;

  /** Free-form address; built from the most-specific tags available. */
  address: string | null;

  phone: string | null;
  website: string | null;
  vhfChannel: string | null;

  /** Known fuel availability. null = not listed in OSM. */
  hasGasoline: boolean | null;
  hasDiesel: boolean | null;
  /** Generic fuel flag, used when type isn't specified. */
  hasFuel: boolean | null;

  hasPumpout: boolean | null;
  hasShorePower: boolean | null;
  hasRestrooms: boolean | null;
  hasShowers: boolean | null;
  hasRestaurant: boolean | null;
  hasMarineStore: boolean | null;

  /** Number of slips/berths if tagged. */
  slipCapacity: number | null;

  description: string | null;
}

/* ─────────── helpers ─────────── */

const truthy = (v: string | undefined): boolean | null => {
  if (v == null) return null;
  const s = v.toLowerCase();
  if (['yes', 'true', '1', 'designated'].includes(s)) return true;
  if (['no', 'false', '0'].includes(s)) return false;
  return null;
};

function buildAddress(tags: Record<string, string>): string | null {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const cityRegion = [tags['addr:city'], tags['addr:state']].filter(Boolean).join(', ');
  const parts = [street, cityRegion, tags['addr:postcode']].filter(Boolean);
  if (parts.length === 0) return tags['addr:full'] ?? null;
  return parts.join(', ');
}

function parseElement(el: OverpassElement): Marina | null {
  const tags = el.tags ?? {};
  if (tags.leisure !== 'marina') return null;

  const lat = el.type === 'node' ? el.lat : el.center?.lat;
  const lng = el.type === 'node' ? el.lon : el.center?.lon;
  if (lat == null || lng == null) return null;

  const phone = tags.phone ?? tags['contact:phone'] ?? null;
  const website = tags.website ?? tags['contact:website'] ?? null;
  const vhfChannel = tags['vhf_channel'] ?? tags['channel:vhf'] ?? null;

  // Fuel detection — many tagging conventions in the wild.
  const hasGasoline =
    truthy(tags['fuel:gasoline']) ??
    truthy(tags['fuel:petrol']) ??
    truthy(tags['fuel:octane_87']);
  const hasDiesel = truthy(tags['fuel:diesel']);
  const hasFuel =
    truthy(tags.fuel) ??
    (hasGasoline === true || hasDiesel === true ? true : null);

  const slipCapacityRaw = tags['capacity:berth'] ?? tags.capacity;
  const slipCapacityN = slipCapacityRaw != null ? Number.parseInt(slipCapacityRaw, 10) : NaN;

  return {
    id: `${el.type}/${el.id}`,
    name: tags.name ?? 'Unnamed marina',
    lat,
    lng,
    address: buildAddress(tags),
    phone,
    website,
    vhfChannel,
    hasGasoline,
    hasDiesel,
    hasFuel,
    hasPumpout:
      truthy(tags['sanitary_dump_station']) ??
      truthy(tags['service:vehicle:boat:pumpout']) ??
      null,
    hasShorePower: truthy(tags['power_supply']) ?? truthy(tags.power) ?? null,
    hasRestrooms: truthy(tags.toilets),
    hasShowers: truthy(tags.shower),
    hasRestaurant: tags.restaurant != null ? true : truthy(tags['restaurant']),
    hasMarineStore: tags['shop'] === 'boat' || tags['shop'] === 'chandlery' ? true : null,
    slipCapacity: Number.isFinite(slipCapacityN) ? slipCapacityN : null,
    description: tags.description ?? null,
  };
}

/* ─────────── Overpass ─────────── */

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function overpassQuery(b: Bbox): string {
  // Overpass bbox order is (south, west, north, east).
  const box = `${b.south},${b.west},${b.north},${b.east}`;
  return `
    [out:json][timeout:25];
    (
      node["leisure"="marina"](${box});
      way["leisure"="marina"](${box});
    );
    out center tags;
  `;
}

export async function getMarinasInBbox(bbox: Bbox): Promise<Marina[]> {
  // Quantize so minor pan jitter shares the cache slot.
  const q = quantizeBbox(bbox, 0.1);
  const key = `osm:marinas:${q.west},${q.south},${q.east},${q.north}`;

  return withTtl(key, TTL.ONE_DAY, async () => {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery(q))}`,
      // Don't let Next's default fetch caching interfere with our TTL.
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const data = (await res.json()) as OverpassResponse;
    return data.elements
      .map(parseElement)
      .filter((m): m is Marina => m !== null);
  });
}
