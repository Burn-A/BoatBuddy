/**
 * GET /api/marinas?bbox=west,south,east,north
 *
 * Returns marinas (OSM leisure=marina) in the bbox. Detail is included
 * in the list response — unlike tides/waves, marina records are small
 * and the user almost always taps one immediately after panning, so we
 * save the extra round trip.
 */

import { NextResponse } from 'next/server';
import { parseBbox } from '@/lib/bbox';
import { getMarinasInBbox, MARINA_ATTRIBUTION } from '@/lib/osm/marinas';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bbox = parseBbox(url.searchParams.get('bbox'));
  if (!bbox) {
    return NextResponse.json(
      { error: 'Missing or malformed bbox query param. Expect west,south,east,north.' },
      { status: 400 },
    );
  }

  try {
    const marinas = await getMarinasInBbox(bbox);
    return NextResponse.json(
      { marinas, attribution: MARINA_ATTRIBUTION },
      {
        headers: {
          // Marina data changes very slowly, so the edge can hold it
          // for an hour with up to a day of stale-while-revalidate.
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
