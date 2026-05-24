/**
 * GET /api/tides/[id]
 *
 * Returns latest water level + next high/low predictions for a single
 * CO-OPS station.
 */

import { NextResponse } from 'next/server';
import { getStationDetail } from '@/lib/noaa/coops';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: { id: string } }) {
  const stationId = context.params.id;
  if (!/^[0-9]{6,8}$/.test(stationId)) {
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
