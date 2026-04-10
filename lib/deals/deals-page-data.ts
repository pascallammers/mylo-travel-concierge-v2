import 'server-only';

import type { FlightDeal } from '@/lib/db/schema';
import { getPriceHistoryForRoute } from '@/lib/db/deal-queries';
import { getAirportDetails } from '@/lib/utils/airport-database';
import { computePriceStats } from '@/lib/services/deal-score-core';
import {
  scoreDealForPreferences,
  type DealPreferenceSnapshot,
} from './deal-personalization';
import {
  buildDealsPageModel,
  type DealsPageFilters,
  type DealsPageModel,
  type DealsPageModelDeal,
} from './deals-page-model';

/**
 * Build the complete SSR data model for the deals page.
 *
 * @param deals - Raw deals loaded from the database.
 * @param filters - Active UI filters from the URL.
 * @param now - Current timestamp used for stale calculation.
 * @returns Presentation-ready page model with grouping and filters applied.
 */
export async function buildDealsPageData(
  deals: FlightDeal[],
  filters: DealsPageFilters,
  now: Date = new Date(),
  preferences?: DealPreferenceSnapshot | null,
): Promise<DealsPageModel> {
  const routeStatsByKey = await getRouteStatsByKey(deals);
  const routeDistanceByKey = await getRouteDistanceByKey(deals);
  const modelDeals: DealsPageModelDeal[] = deals.map((deal) => {
    const routeKey = getRouteKey(deal.origin, deal.destination, deal.cabinClass);
    const routeKeyWithSource = getRouteKey(deal.origin, deal.destination, deal.cabinClass, deal.source);
    const personalization = preferences
      ? scoreDealForPreferences(
          {
            origin: deal.origin,
            destination: deal.destination,
            destinationName: deal.destinationName,
            price: deal.price,
            currency: deal.currency,
            cabinClass: deal.cabinClass,
            source: deal.source,
            dealScore: deal.dealScore,
          },
          preferences,
        )
      : null;

    return {
      id: deal.id,
      origin: deal.origin,
      destination: deal.destination,
      destinationName: deal.destinationName,
      departureDate: deal.departureDate,
      returnDate: deal.returnDate,
      price: deal.price,
      currency: deal.currency,
      cabinClass: deal.cabinClass,
      averagePrice: deal.averagePrice,
      priceDifference: deal.priceDifference,
      priceChangePercent: deal.priceChangePercent,
      dealScore: deal.dealScore,
      personalizedScore: personalization?.score ?? null,
      personalizationReasons: personalization?.reasons ?? [],
      airline: deal.airline,
      source: deal.source,
      flightDurationMinutes: deal.flightDuration ?? null,
      affiliateLink: deal.affiliateLink,
      stops: deal.stops,
      tripType: deal.tripType,
      updatedAt: deal.updatedAt,
      routeDistanceKm: routeDistanceByKey.get(routeKey) ?? null,
      priceHistoryStats: routeStatsByKey.get(routeKeyWithSource) ?? null,
    };
  });

  return buildDealsPageModel({
    deals: modelDeals,
    filters,
    now,
  });
}

async function getRouteStatsByKey(
  deals: FlightDeal[],
): Promise<Map<string, { min: number; max: number; count: number } | null>> {
  const uniqueRoutes = new Map<string, Pick<FlightDeal, 'origin' | 'destination' | 'cabinClass' | 'source'>>();

  for (const deal of deals) {
    const routeKey = getRouteKey(deal.origin, deal.destination, deal.cabinClass, deal.source);
    if (!uniqueRoutes.has(routeKey)) {
      uniqueRoutes.set(routeKey, {
        origin: deal.origin,
        destination: deal.destination,
        cabinClass: deal.cabinClass,
        source: deal.source,
      });
    }
  }

  const routeEntries = Array.from(uniqueRoutes.entries());
  const statsEntries = await Promise.all(
    routeEntries.map(async ([routeKey, route]) => {
      const prices = await getPriceHistoryForRoute(
        route.origin,
        route.destination,
        route.cabinClass,
        route.source,
      );
      const stats = computePriceStats(prices);

      return [
        routeKey,
        stats
          ? {
              min: stats.min,
              max: stats.max,
              count: stats.count,
            }
          : null,
      ] as const;
    }),
  );

  return new Map(statsEntries);
}

async function getRouteDistanceByKey(
  deals: FlightDeal[],
): Promise<Map<string, number | null>> {
  const airportCodes = Array.from(
    new Set(
      deals.flatMap((deal) => [deal.origin, deal.destination]),
    ),
  );
  const airportEntries = await Promise.all(
    airportCodes.map(async (code) => [code, await getAirportDetails(code)] as const),
  );
  const airportByCode = new Map(airportEntries);
  const routeDistanceByKey = new Map<string, number | null>();

  for (const deal of deals) {
    const routeKey = getRouteKey(deal.origin, deal.destination, deal.cabinClass);
    if (routeDistanceByKey.has(routeKey)) {
      continue;
    }

    const originAirport = airportByCode.get(deal.origin);
    const destinationAirport = airportByCode.get(deal.destination);

    if (!originAirport || !destinationAirport) {
      routeDistanceByKey.set(routeKey, null);
      continue;
    }

    routeDistanceByKey.set(
      routeKey,
      calculateDistanceKm(
        originAirport.latitude,
        originAirport.longitude,
        destinationAirport.latitude,
        destinationAirport.longitude,
      ),
    );
  }

  return routeDistanceByKey;
}

function getRouteKey(
  origin: string,
  destination: string,
  cabinClass: FlightDeal['cabinClass'],
  source?: string,
): string {
  return `${origin}:${destination}:${cabinClass}:${source ?? 'all'}`;
}

function calculateDistanceKm(
  originLatitude: number,
  originLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): number {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(destinationLatitude - originLatitude);
  const longitudeDelta = toRadians(destinationLongitude - originLongitude);
  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(toRadians(originLatitude)) *
      Math.cos(toRadians(destinationLatitude)) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);
  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return Math.round(earthRadiusKm * arc);
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
