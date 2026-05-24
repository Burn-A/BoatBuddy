/**
 * Client-side hooks for tide-station data.
 *
 * Talks only to the BFF — never directly to NOAA. The bbox is quantized
 * before being used as a cache key so minor pan jitter shares the same
 * query, matching ARCHITECTURE §7.
 */

import { useQuery } from '@tanstack/react-query';
import { formatBbox, quantizeBbox, type Bbox } from '@/lib/bbox';
import type { CoopsStation, CoopsStationDetail } from '@/lib/noaa/coops';

const ONE_HOUR = 60 * 60 * 1000;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return (await res.json()) as T;
}

export function useTideStations(bbox: Bbox | null) {
  const key = bbox ? formatBbox(quantizeBbox(bbox)) : null;
  return useQuery({
    queryKey: ['tides', 'stations', key],
    enabled: !!bbox,
    staleTime: ONE_HOUR,
    queryFn: async () => {
      const data = await fetchJson<{ stations: CoopsStation[] }>(`/api/tides?bbox=${key}`);
      return data.stations;
    },
  });
}

export function useTideDetail(stationId: string | null) {
  return useQuery({
    queryKey: ['tides', 'detail', stationId],
    enabled: !!stationId,
    staleTime: 30 * 60 * 1000,
    queryFn: () => fetchJson<CoopsStationDetail>(`/api/tides/${stationId}`),
  });
}
