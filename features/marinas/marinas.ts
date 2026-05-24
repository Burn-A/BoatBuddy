/**
 * Client-side hooks for marina data.
 *
 * Talks only to the BFF — never directly to Overpass. The list response
 * already carries all detail, so there's no `useMarinaDetail` hook;
 * components pull the chosen marina out of the list by id.
 */

import { useQuery } from '@tanstack/react-query';
import { formatBbox, quantizeBbox, type Bbox } from '@/lib/bbox';
import type { Marina } from '@/lib/osm/marinas';

const ONE_HOUR = 60 * 60 * 1000;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return (await res.json()) as T;
}

export function useMarinas(bbox: Bbox | null) {
  const key = bbox ? formatBbox(quantizeBbox(bbox, 0.1)) : null;
  return useQuery({
    queryKey: ['marinas', key],
    enabled: !!bbox,
    staleTime: 24 * ONE_HOUR,
    queryFn: async () => {
      const data = await fetchJson<{ marinas: Marina[]; attribution: string }>(
        `/api/marinas?bbox=${key}`,
      );
      return data;
    },
  });
}
