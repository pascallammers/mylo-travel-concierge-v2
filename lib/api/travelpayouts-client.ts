import 'server-only';
import { serverEnv } from '@/env/server';
import {
  buildTravelpayoutsAffiliateLink,
  type TravelpayoutsAffiliateLinkParams,
} from './travelpayouts-affiliate-link';

const BASE_URL = 'https://api.travelpayouts.com';

function getToken(): string {
  const token = serverEnv.TRAVELPAYOUTS_API_TOKEN;
  if (!token) {
    throw new Error('TRAVELPAYOUTS_API_TOKEN is not configured');
  }
  return token;
}

// --- Types ---

export interface TravelpayoutsCheapTicket {
  price: number;
  airline: string;
  flight_number: number;
  departure_at: string;
  return_at: string;
  transfers: number;
  expires_at: string;
}

export interface TravelpayoutsCheapResponse {
  success: boolean;
  data: Record<string, Record<string, TravelpayoutsCheapTicket>>;
  currency: string;
}

export interface TravelpayoutsDirectTicket {
  price: number;
  airline: string;
  flight_number: number;
  departure_at: string;
  return_at: string;
  transfers: number;
  expires_at: string;
}

export interface TravelpayoutsDirectResponse {
  success: boolean;
  data: Record<string, Record<string, TravelpayoutsDirectTicket>>;
  currency: string;
}

export interface TravelpayoutsLatestPrice {
  value: number;
  trip_class: number;
  show_to_affiliates: boolean;
  origin: string;
  destination: string;
  gate: string;
  depart_date: string;
  return_date: string;
  number_of_changes: number;
  found_at: string;
  distance: number;
  actual: boolean;
}

export interface TravelpayoutsLatestResponse {
  success: boolean;
  data: TravelpayoutsLatestPrice[];
  currency: string;
}

// --- API Functions ---

/**
 * Cheapest tickets for a route (cached data, up to 7 days old).
 * If destination is omitted, returns cheapest tickets to all destinations from origin.
 */
export async function getCheapTickets(params: {
  origin: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  currency?: string;
}): Promise<TravelpayoutsCheapResponse> {
  const url = new URL(`${BASE_URL}/v1/prices/cheap`);
  url.searchParams.set('origin', params.origin);
  if (params.destination) url.searchParams.set('destination', params.destination);
  if (params.departDate) url.searchParams.set('depart_date', params.departDate);
  if (params.returnDate) url.searchParams.set('return_date', params.returnDate);
  url.searchParams.set('currency', params.currency || 'eur');
  // Token sent via X-Access-Token header only (not in URL for security)

  const response = await fetch(url.toString(), {
    headers: { 'X-Access-Token': getToken() },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Travelpayouts] getCheapTickets failed:', response.status, text);
    throw new Error(`Travelpayouts API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Cheapest direct (non-stop) flights for a route.
 */
export async function getDirectFlights(params: {
  origin: string;
  destination: string;
  departDate?: string;
  returnDate?: string;
  currency?: string;
}): Promise<TravelpayoutsDirectResponse> {
  const url = new URL(`${BASE_URL}/v1/prices/direct`);
  url.searchParams.set('origin', params.origin);
  url.searchParams.set('destination', params.destination);
  if (params.departDate) url.searchParams.set('depart_date', params.departDate);
  if (params.returnDate) url.searchParams.set('return_date', params.returnDate);
  url.searchParams.set('currency', params.currency || 'eur');
  // Token sent via X-Access-Token header only (not in URL for security)

  const response = await fetch(url.toString(), {
    headers: { 'X-Access-Token': getToken() },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Travelpayouts] getDirectFlights failed:', response.status, text);
    throw new Error(`Travelpayouts API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Latest prices found by users in the last 48 hours.
 * Great for deal discovery — returns prices across many routes.
 */
export async function getLatestPrices(params: {
  origin: string;
  destination?: string;
  periodType?: 'year' | 'month' | 'season' | 'day';
  beginningOfPeriod?: string;
  oneWay?: boolean;
  currency?: string;
  limit?: number;
  page?: number;
}): Promise<TravelpayoutsLatestResponse> {
  const url = new URL(`${BASE_URL}/v2/prices/latest`);
  url.searchParams.set('origin', params.origin);
  if (params.destination) url.searchParams.set('destination', params.destination);
  url.searchParams.set('period_type', params.periodType || 'month');
  if (params.beginningOfPeriod) url.searchParams.set('beginning_of_period', params.beginningOfPeriod);
  if (params.oneWay !== undefined) url.searchParams.set('one_way', String(params.oneWay));
  url.searchParams.set('currency', params.currency || 'eur');
  url.searchParams.set('limit', String(params.limit || 30));
  url.searchParams.set('page', String(params.page || 1));
  url.searchParams.set('show_to_affiliates', 'true');
  url.searchParams.set('sorting', 'price');
  // Token sent via X-Access-Token header only (not in URL for security)

  const response = await fetch(url.toString(), {
    headers: { 'X-Access-Token': getToken() },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Travelpayouts] getLatestPrices failed:', response.status, text);
    throw new Error(`Travelpayouts API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Generate Aviasales affiliate deep link for a flight.
 */
export function generateAffiliateLink(
  params: TravelpayoutsAffiliateLinkParams,
): string {
  // Travelpayouts no longer accepts the legacy /search/FRA260417PMI2604201 format reliably.
  // The searches/new bootstrap URL redirects into a working flight search experience.
  return buildTravelpayoutsAffiliateLink(params);
}
