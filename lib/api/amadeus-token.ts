import { db } from '@/lib/db/drizzle';
import { amadeusTokens } from '@/lib/db/schema';
import { desc, eq, and, gt } from 'drizzle-orm';

/**
 * Get or refresh Amadeus OAuth2 token
 * @param environment - Amadeus environment ('test' or 'prod')
 * @returns Access token
 */
export async function getAmadeusToken(
  environment: 'test' | 'prod' = 'test'
): Promise<string> {
  // 1. Check for cached valid token
  const cached = await db.query.amadeusTokens.findFirst({
    where: and(
      eq(amadeusTokens.environment, environment),
      gt(amadeusTokens.expiresAt, new Date())
    ),
    orderBy: desc(amadeusTokens.createdAt),
  });

  if (cached) {
    console.log('[Amadeus] Using cached token');
    return cached.accessToken;
  }

  // 2. Request new token
  console.log('[Amadeus] Requesting new token');
  const baseUrl =
    environment === 'prod'
      ? 'https://api.amadeus.com'
      : 'https://test.api.amadeus.com';

  const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_API_KEY!,
      client_secret: process.env.AMADEUS_API_SECRET!,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Amadeus token request failed: ${error}`);
  }

  const data = await response.json();

  // 3. Store token with expiration
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await db.insert(amadeusTokens).values({
    environment,
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresAt,
  });

  console.log('[Amadeus] New token stored, expires at:', expiresAt);
  return data.access_token;
}

/**
 * Clear expired tokens from database
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const deleted = await db
    .delete(amadeusTokens)
    .where(gt(new Date(), amadeusTokens.expiresAt))
    .returning({ id: amadeusTokens.id });

  console.log(`[Amadeus] Cleaned up ${deleted.length} expired tokens`);
}
