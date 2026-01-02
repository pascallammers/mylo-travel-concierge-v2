import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAuthUrl } from '@/lib/api/awardwallet-client';
import { ChatSDKError } from '@/lib/errors';

/**
 * POST /api/awardwallet/auth/initiate
 * Generates AwardWallet OAuth consent URL for authenticated users
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

    console.log('[AwardWallet] OAuth initiated for user:', session.user.id);

    const authUrl = await createAuthUrl();

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('[AwardWallet] Auth initiate error:', error);

    if (error instanceof ChatSDKError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        code: 'bad_request:api',
        message: 'Failed to generate authorization URL',
      },
      { status: 500 },
    );
  }
}
