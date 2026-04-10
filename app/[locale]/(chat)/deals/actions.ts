'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getUser } from '@/lib/auth-utils';
import { upsertUserDealPreferences } from '@/lib/db/deal-queries';
import { resolveAirportCodeList } from '@/lib/deals';

const saveDealPreferencesSchema = z.object({
  locale: z.string().min(2).max(8),
  originAirports: z.string().default(''),
  preferredDestinations: z.string().default(''),
  cabinClass: z.enum(['any', 'economy', 'premium_economy', 'business', 'first']).default('any'),
  maxPrice: z.string().default(''),
  emailDigest: z.enum(['none', 'weekly', 'daily']).default('none'),
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
