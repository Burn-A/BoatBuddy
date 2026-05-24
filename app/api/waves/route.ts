/**
 * GET /api/waves?bbox=west,south,east,north
 *
 * Returns NDBC stations inside the bbox.
 */

import { NextResponse } from 'next/server';
import { parseBbox } from '@/lib/bbox';
import { getStationsInBbox } from '@/lib/noaa/ndbc';

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
    const stations = await getStationsInBbox(bbox.west, bbox.south, bbox.east, bbox.north);
    return NextResponse.json(
      { stations },
      {
        headers: {
          'Cache-Control': 's-maxage=1800, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
