/**
 * NDBC (National Data Buoy Center) client.
 *
 * Active stations come from a single XML feed; per-station observations
 * come from a whitespace-separated `realtime2/<id>.txt` file with the
 * latest row on top. Both are cached server-side per ARCHITECTURE.md §5.2.
 *
 * NDBC station identifiers are alphanumeric (e.g. "44013"). We accept
 * lower-case and normalize.
 */

import { TTL, withTtl } from '@/lib/serverCache';

const STATIONS_URL = 'https://www.ndbc.noaa.gov/activestations.xml';
const realtimeUrl = (id: string) =>
  `https://www.ndbc.noaa.gov/data/realtime2/${id.toUpperCase()}.txt`;

export interface NdbcStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** "buoy" or "fixed" (CMAN). Some entries are absent in the feed. */
  type: string;
}

export interface NdbcObservation {
  /** ISO 8601 UTC. */
  timeUtc: string;
  /** Wind direction in degrees true, or null if not reported. */
  windDirDeg: number | null;
  /** Wind speed, m/s. */
  windSpeedMps: number | null;
  /** Gust, m/s. */
  gustMps: number | null;
  /** Significant wave height, meters. */
  sigWaveHeightM: number | null;
  /** Dominant wave period, seconds. */
  dominantPeriodS: number | null;
  /** Sea surface temperature, °C. */
  waterTempC: number | null;
  /** Air temperature, °C. */
  airTempC: number | null;
}

export interface NdbcStationDetail {
  station: NdbcStation;
  latest: NdbcObservation | null;
}

/* ─────────── station catalog ─────────── */

/**
 * NDBC's activestations.xml is well-formed but not JSON. Rather than
 * pull a parser dependency, we extract the few attributes we need with
 * a regex over `<station ... />` tags. The format is stable enough for
 * this approach to be safe at this scale.
 */
const STATION_RE = /<station\s+([^/]+?)\/>/g;
const ATTR_RE = /(\w+)="([^"]*)"/g;

export async function getStationCatalog(): Promise<NdbcStation[]> {
  return withTtl('ndbc:catalog', TTL.ONE_DAY, async () => {
    const res = await fetch(STATIONS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`NDBC catalog ${res.status}`);
    const xml = await res.text();

    const out: NdbcStation[] = [];
    let m: RegExpExecArray | null;
    while ((m = STATION_RE.exec(xml)) != null) {
      const attrs: Record<string, string> = {};
      let a: RegExpExecArray | null;
      const inner = m[1];
      ATTR_RE.lastIndex = 0;
      while ((a = ATTR_RE.exec(inner)) != null) attrs[a[1]] = a[2];

      const id = attrs.id;
      const lat = Number.parseFloat(attrs.lat);
      const lng = Number.parseFloat(attrs.lon);
      if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.push({
        id,
        name: attrs.name ?? id,
        lat,
        lng,
        type: attrs.type ?? '',
      });
    }
    return out;
  });
}

export async function getStationsInBbox(
  west: number,
  south: number,
  east: number,
  north: number,
): Promise<NdbcStation[]> {
  const all = await getStationCatalog();
  return all.filter(
    (s) => s.lng >= west && s.lng <= east && s.lat >= south && s.lat <= north,
  );
}

/* ─────────── observation parser ─────────── */

/**
 * The realtime2 .txt format:
 *   #YY  MM DD hh mm WDIR WSPD GST  WVHT  DPD  APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
 *   #yr  mo dy hr mn degT m/s  m/s   m    sec  sec degT  hPa   degC  degC  degC  nmi  hPa   ft
 *   2026 05 23 14 50 180  4.0  5.0   1.2  6.0  4.5 170  1015.3 21.0  19.5  18.3   MM   MM   MM
 *
 * The first non-comment row is the most recent observation. "MM" means
 * "missing". We parse defensively — any column that's malformed becomes
 * null so a single bad station doesn't poison the whole response.
 */
const NUM_OR_NULL = (s: string | undefined): number | null => {
  if (!s || s === 'MM' || s === '-') return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export function parseLatestObservation(text: string): NdbcObservation | null {
  const lines = text.split(/\r?\n/);
  const data = lines.find((l) => l && !l.startsWith('#'));
  if (!data) return null;

  const cols = data.trim().split(/\s+/);
  // Columns 0-4 are YY MM DD hh mm.
  const [yy, mo, dd, hh, mn] = cols;
  const iso = `${yy}-${mo}-${dd}T${hh}:${mn}:00Z`;

  return {
    timeUtc: iso,
    windDirDeg: NUM_OR_NULL(cols[5]),
    windSpeedMps: NUM_OR_NULL(cols[6]),
    gustMps: NUM_OR_NULL(cols[7]),
    sigWaveHeightM: NUM_OR_NULL(cols[8]),
    dominantPeriodS: NUM_OR_NULL(cols[9]),
    airTempC: NUM_OR_NULL(cols[13]),
    waterTempC: NUM_OR_NULL(cols[14]),
  };
}

export async function getStationDetail(stationId: string): Promise<NdbcStationDetail | null> {
  return withTtl(`ndbc:detail:${stationId}`, TTL.THIRTY_MINUTES, async () => {
    const catalog = await getStationCatalog();
    const station = catalog.find((s) => s.id.toUpperCase() === stationId.toUpperCase());
    if (!station) return null;

    const res = await fetch(realtimeUrl(stationId), { cache: 'no-store' });
    if (!res.ok) return { station, latest: null };

    const text = await res.text();
    return { station, latest: parseLatestObservation(text) };
  });
}
