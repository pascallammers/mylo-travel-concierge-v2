'use server';

import { getComprehensiveUserData } from '@/lib/user-data-server';

/**
 * Loads the authenticated user's bootstrap data for initial app rendering.
 * @returns The comprehensive authenticated user object, or `null` when no session is present.
 */
export async function getCurrentUserBootstrapData() {
  return await getComprehensiveUserData();
}
