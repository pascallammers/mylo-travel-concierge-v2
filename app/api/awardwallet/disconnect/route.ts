import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteConnection } from '@/lib/db/queries/awardwallet';
import { ChatSDKError } from '@/lib/errors';

/**
 * POST /api/awardwallet/disconnect
 * Removes AwardWallet connection and all associated loyalty accounts
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

    console.log('[AwardWallet] Disconnect requested for user:', userId);

    const deleted = await deleteConnection(userId);

    if (!deleted) {
      return NextResponse.json(
        {
          code: 'bad_request:api',
          message: 'No AwardWallet connection found',
        },
        { status: 400 },
      );
    }

    console.log('[AwardWallet] Disconnected successfully for user:', userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AwardWallet] Disconnect error:', error);

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
        message: 'Failed to disconnect AwardWallet',
      },
      { status: 500 },
    );
  }
}
