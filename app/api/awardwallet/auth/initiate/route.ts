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

    console.error('[AwardWallet] OAuth initiated for user:', session.user.id);

    let authUrl: string;
    try {
      authUrl = await createAuthUrl();
    } catch (createError) {
      const errMsg = createError instanceof Error
        ? `${createError.name}: ${createError.message}`
        : String(createError);
      const errCause = createError instanceof ChatSDKError
        ? createError.cause
        : undefined;
      console.error('[AwardWallet] createAuthUrl failed:', errMsg, 'cause:', errCause);

      if (createError instanceof ChatSDKError) {
        return createError.toResponse();
      }

      return NextResponse.json(
        {
          code: 'bad_request:api',
          message: 'Failed to generate authorization URL',
        },
        { status: 500 },
      );
    }

    if (!authUrl) {
      console.error('[AwardWallet] createAuthUrl returned falsy value:', authUrl);
      return NextResponse.json(
        {
          code: 'bad_request:api',
          message: 'Failed to generate authorization URL',
        },
        { status: 500 },
      );
    }

    console.error('[AwardWallet] OAuth URL generated for user:', session.user.id);
    return NextResponse.json({ authUrl });
  } catch (error) {
    const errMsg = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
    console.error('[AwardWallet] Auth initiate outer error:', errMsg);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
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
