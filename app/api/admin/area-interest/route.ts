import { getAdminAuthError } from '@/lib/auth-guards';
import { getUser, getUserRole } from '@/lib/auth-utils';
import { countAreaInterestByArea } from '@/lib/db/queries/area-interest';

/**
 * Return preview interest counts to authenticated administrators.
 * @returns Counts for every preview area, or the admin authorization error.
 */
export async function GET(): Promise<Response> {
  const authError = await getAdminAuthError({ getUser, getUserRole });
  if (authError) return authError;

  return Response.json({ counts: await countAreaInterestByArea() });
}
