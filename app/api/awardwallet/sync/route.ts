import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { auth } from '@/lib/auth';
import { getConnectedUser } from '@/lib/api/awardwallet-client';
import { getConnection, syncLoyaltyAccounts } from '@/lib/db/queries/awardwallet';
import { ChatSDKError } from '@/lib/errors';
import { serverEnv } from '@/env/server';

const redis = new Redis({
  url: serverEnv.UPSTASH_REDIS_REST_URL,
  token: serverEnv.UPSTASH_REDIS_REST_TOKEN,
});

const RATE_LIMIT_SECONDS = 5 * 60; // 5 minutes

/**
 * POST /api/awardwallet/sync
 * Triggers manual sync of loyalty accounts with rate limiting
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          code: 'unauthorized:auth',
          message: 'You need to sign in before continuing.',
        },
        { status: 401 },
      );
    }

    const userId = session.user.id;

    // Check for existing connection
    const connection = await getConnection(userId);
    if (!connection) {
      return NextResponse.json(
        {
          code: 'bad_request:api',
          message: 'No AwardWallet connection found',
        },
        { status: 400 },
      );
    }

    // Rate limiting check
    const rateLimitKey = `awardwallet:sync:${userId}`;
    const lastSync = await redis.get<number>(rateLimitKey);

    if (lastSync) {
      const secondsSinceLastSync = Math.floor((Date.now() - lastSync) / 1000);
      const remainingSeconds = RATE_LIMIT_SECONDS - secondsSinceLastSync;

      if (remainingSeconds > 0) {
        return NextResponse.json(
          {
            code: 'rate_limit:api',
            message: `Please wait ${Math.ceil(remainingSeconds / 60)} minutes before syncing again`,
            retryAfter: remainingSeconds,
          },
          { status: 429 },
        );
      }
    }

    // Set rate limit
    await redis.set(rateLimitKey, Date.now(), { ex: RATE_LIMIT_SECONDS });

    console.log('[AwardWallet] Manual sync started for user:', userId);

    // Fetch latest data from AwardWallet
    const accounts = await getConnectedUser(connection.awUserId);

    // Update database
    const accountCount = await syncLoyaltyAccounts(connection.id, accounts);

    const syncedAt = new Date().toISOString();
    console.log('[AwardWallet] Manual sync completed:', accountCount, 'accounts');

    return NextResponse.json({
      success: true,
      syncedAt,
      accountCount,
    });
  } catch (error) {
    console.error('[AwardWallet] Sync error:', error);

    if (error instanceof ChatSDKError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
        },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        code: 'bad_request:api',
        message: 'Failed to sync loyalty accounts',
      },
      { status: 500 },
    );
  }
}
