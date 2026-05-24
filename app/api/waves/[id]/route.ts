/**
 * GET /api/waves/[id]
 *
 * Returns the latest observation for a single NDBC station.
 */

import { NextResponse } from 'next/server';
import { getStationDetail } from '@/lib/noaa/ndbc';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: { id: string } }) {
  const stationId = context.params.id;
  if (!/^[A-Za-z0-9]{4,8}$/.test(stationId)) {
    return NextResponse.json({ error: 'Invalid station id.' }, { status: 400 });
  }

  try {
    const detail = await getStationDetail(stationId);
    if (!detail) {
      return NextResponse.json({ error: 'Station not found.' }, { status: 404 });
    }
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=86400' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
