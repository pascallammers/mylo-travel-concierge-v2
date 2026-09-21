'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getUser } from '@/lib/auth-utils';
import { upsertUserDealPreferences } from '@/lib/db/deal-queries';
import { resolveAirportCodeList } from '@/lib/deals';
import { hasFlightDealsAccess } from '@/lib/deals/flight-deals-access';

const saveDealPreferencesSchema = z.object({
  locale: z.string().min(2).max(8),
  originAirports: z.string().default(''),
  preferredDestinations: z.string().default(''),
  cabinClass: z.enum(['any', 'economy', 'premium_economy', 'business', 'first']).default('any'),
  maxPrice: z.string().default(''),
  emailDigest: z.enum(['none', 'weekly', 'daily']).default('none'),
});

const subscribeWeeklyDigestSchema = z.object({
  locale: z.string().min(2).max(8),
  originAirports: z.array(z.string().regex(/^[A-Z]{3}$/)).max(10),
});

export interface SaveDealPreferencesInput {
  locale: string;
  originAirports: string;
  preferredDestinations: string;
  cabinClass: 'any' | 'economy' | 'premium_economy' | 'business' | 'first';
  maxPrice: string;
  emailDigest: 'none' | 'weekly' | 'daily';
}

/**
 * Persist the authenticated user's deal preferences and refresh relevant routes.
 *
 * @param input - Raw form payload from the deals preferences panel.
 * @returns Success result for optimistic UI feedback.
 */
export async function saveDealPreferencesAction(input: SaveDealPreferencesInput) {
  const user = await getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }
  if (!(await hasFlightDealsAccess(user.id))) {
    throw new Error('Forbidden');
  }

  const parsed = saveDealPreferencesSchema.parse(input);
  const maxPrice = parsed.maxPrice.trim() === '' ? null : Number(parsed.maxPrice);
  const [originAirports, preferredDestinations] = await Promise.all([
    resolveAirportCodeList(parsed.originAirports),
    resolveAirportCodeList(parsed.preferredDestinations),
  ]);

  await upsertUserDealPreferences(user.id, {
    originAirports,
    preferredDestinations,
    cabinClass: parsed.cabinClass === 'any' ? null : parsed.cabinClass,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
    emailDigest: parsed.emailDigest,
  });

  revalidatePath(`/${parsed.locale}`);
  revalidatePath(`/${parsed.locale}/deals`);
  revalidatePath(`/${parsed.locale}/new`);

  return { success: true };
}

/**
 * Subscribe the authenticated member to weekly deals from the active airports.
 * @param input - Locale and selected IATA codes; an empty list preserves saved origins.
 * @returns Success result after saving the digest and refreshing the deals page.
 */
export async function subscribeWeeklyDigestAction(input: { locale: string; originAirports: string[] }) {
  const user = await getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }
  if (!(await hasFlightDealsAccess(user.id))) {
    throw new Error('Forbidden');
  }

  const parsed = subscribeWeeklyDigestSchema.parse(input);
  await upsertUserDealPreferences(user.id, {
    emailDigest: 'weekly',
    ...(parsed.originAirports.length > 0 ? { originAirports: parsed.originAirports } : {}),
  });
  revalidatePath(`/${parsed.locale}/deals`);

  return { success: true };
}
