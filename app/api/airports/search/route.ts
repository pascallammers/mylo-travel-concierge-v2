import { NextRequest, NextResponse } from 'next/server';
import { searchAirports } from '@/lib/utils/airport-database';

/**
 * Search airports by city, airport name, or IATA code for the deals preferences UI.
 *
 * @param request - Incoming HTTP request with the search query.
 * @returns JSON payload with ranked airport suggestions.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return NextResponse.json({ airports: [] });
  }

  const airports = await searchAirports(query, 8);
  return NextResponse.json({ airports });
}
