/**
 * NOAA CO-OPS (tides & water levels) client.
 *
 * Server-only. The public station catalog is cached for 24h; per-station
 * observations and predictions are cached for 30 minutes — well within
 * the 1-hour freshness budget in NFR-004.
 *
 * Docs: https://api.tidesandcurrents.noaa.gov/api/prod/
 *       https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json
 */

import { TTL, withTtl } from '@/lib/serverCache';

const STATIONS_URL =
  'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels';
const DATA_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

export interface CoopsStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: string;
}

export interface CoopsWaterLevel {
  /** ISO 8601 in station local time. */
  time: string;
  /** Water level relative to MLLW datum, feet. */
  feet: number;
}

export interface CoopsHiLo {
  time: string;
  /** Predicted water level at this extremum, feet. */
  feet: number;
  type: 'high' | 'low';
}

export interface CoopsStationDetail {
  station: CoopsStation;
  latest: CoopsWaterLevel | null;
  upcoming: CoopsHiLo[];
}

/* ─────────── station catalog ─────────── */

interface CoopsStationRaw {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state?: string;
}

export async function getStationCatalog(): Promise<CoopsStation[]> {
  return withTtl('coops:catalog', TTL.ONE_DAY, async () => {
    const res = await fetch(STATIONS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`CO-OPS catalog ${res.status}`);
    const data = (await res.json()) as { stations: CoopsStationRaw[] };
    return data.stations.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      state: s.state ?? '',
    }));
  });
}

export async function getStationsInBbox(
  west: number,
  south: number,
  east: number,
  north: number,
): Promise<CoopsStation[]> {
  const all = await getStationCatalog();
  return all.filter(
    (s) => s.lng >= west && s.lng <= east && s.lat >= south && s.lat <= north,
  );
}

/* ─────────── per-station observations & predictions ─────────── */

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function fetchWaterLevel(stationId: string): Promise<CoopsWaterLevel | null> {
  const url = new URL(DATA_URL);
  url.search = new URLSearchParams({
    station: stationId,
    product: 'water_level',
    date: 'latest',
    datum: 'MLLW',
    units: 'english',
    time_zone: 'lst_ldt',
    format: 'json',
    application: 'BoatBuddy',
  }).toString();

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    data?: { t: string; v: string }[];
    error?: { message: string };
  };
  if (data.error || !data.data?.length) return null;
  const row = data.data[0];
  return { time: row.t, feet: Number.parseFloat(row.v) };
}

async function fetchPredictions(stationId: string): Promise<CoopsHiLo[]> {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const url = new URL(DATA_URL);
  url.search = new URLSearchParams({
    station: stationId,
    product: 'predictions',
    interval: 'hilo',
    begin_date: yyyymmdd(today),
    end_date: yyyymmdd(tomorrow),
    datum: 'MLLW',
    units: 'english',
    time_zone: 'lst_ldt',
    format: 'json',
    application: 'BoatBuddy',
  }).toString();

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    predictions?: { t: string; v: string; type: 'H' | 'L' }[];
  };
  if (!data.predictions) return [];

  const now = Date.now();
  return data.predictions
    .map((p) => ({
      time: p.t,
      feet: Number.parseFloat(p.v),
      type: (p.type === 'H' ? 'high' : 'low') as 'high' | 'low',
    }))
    .filter((p) => new Date(p.time).getTime() > now)
    .slice(0, 4);
}

export async function getStationDetail(stationId: string): Promise<CoopsStationDetail | null> {
  return withTtl(`coops:detail:${stationId}`, TTL.THIRTY_MINUTES, async () => {
    const catalog = await getStationCatalog();
    const station = catalog.find((s) => s.id === stationId);
    if (!station) return null;
    const [latest, upcoming] = await Promise.all([
      fetchWaterLevel(stationId),
      fetchPredictions(stationId),
    ]);
    return { station, latest, upcoming };
  });
}
