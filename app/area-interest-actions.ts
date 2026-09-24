'use server';

import { refresh } from 'next/cache';
import { getUser } from '@/lib/auth-utils';
import { registerAreaInterest } from '@/lib/db/queries/area-interest';
import { parsePreviewAreaSlug, type RegisterAreaInterestResult } from '@/lib/shell/preview-areas';

/**
 * Register the current user's interest in a validated preview area.
 * @param area - Untrusted preview area slug from the client.
 * @returns Success or a login/validation failure; database errors propagate.
 */
export async function registerAreaInterestAction(area: string): Promise<RegisterAreaInterestResult> {
  const user = await getUser();
  if (!user) return { ok: false, reason: 'unauthenticated' };

  const slug = parsePreviewAreaSlug(area);
  if (!slug) return { ok: false, reason: 'unknown_area' };

  await registerAreaInterest(user.id, slug);
  refresh();
  return { ok: true };
}
