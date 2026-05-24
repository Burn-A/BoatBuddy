/**
 * Client-side hooks for NDBC wave-buoy data.
 */

import { useQuery } from '@tanstack/react-query';
import { formatBbox, quantizeBbox, type Bbox } from '@/lib/bbox';
import type { NdbcStation, NdbcStationDetail } from '@/lib/noaa/ndbc';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return (await res.json()) as T;
}

export function useWaveStations(bbox: Bbox | null) {
  const key = bbox ? formatBbox(quantizeBbox(bbox)) : null;
  return useQuery({
    queryKey: ['waves', 'stations', key],
    enabled: !!bbox,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const data = await fetchJson<{ stations: NdbcStation[] }>(`/api/waves?bbox=${key}`);
      return data.stations;
    },
  });
}

export function useWaveDetail(stationId: string | null) {
  return useQuery({
    queryKey: ['waves', 'detail', stationId],
    enabled: !!stationId,
    staleTime: 30 * 60 * 1000,
    queryFn: () => fetchJson<NdbcStationDetail>(`/api/waves/${stationId}`),
  });
}
