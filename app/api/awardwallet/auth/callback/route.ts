import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getConnectionInfo, getConnectedUser } from '@/lib/api/awardwallet-client';
import { createConnection, getConnection, syncLoyaltyAccounts } from '@/lib/db/queries/awardwallet';

const CallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional(),
});

/**
 * GET /api/awardwallet/auth/callback
 * Handles OAuth callback from AwardWallet after user authorization.
 * @param request - Incoming request with OAuth query parameters.
 * @returns Redirect response to settings with success or error state.
 */
export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl?.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const successRedirect = `${baseUrl}/?tab=loyalty#settings`;
  const errorRedirect = `${baseUrl}/?tab=loyalty&error=connection_failed#settings`;

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      console.error('[AwardWallet] Callback: No authenticated session');
      return NextResponse.redirect(errorRedirect);
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    const parsed = CallbackSchema.safeParse({
      code: searchParams.get('code') ?? undefined,
      state: searchParams.get('state') ?? undefined,
    });

    if (!parsed.success) {
      console.error('[AwardWallet] Callback: Invalid parameters', parsed.error.errors);
      return NextResponse.redirect(errorRedirect);
    }

    const { code } = parsed.data;

    // Check if user already has a connection
    const existingConnection = await getConnection(userId);
    if (existingConnection) {
      console.log('[AwardWallet] User already has connection, redirecting to success');
      return NextResponse.redirect(successRedirect);
    }

    // Exchange code for AwardWallet userId
    console.log('[AwardWallet] Exchanging code for user:', userId);
    const connectionInfo = await getConnectionInfo(code);

    // Create connection in database
    const connection = await createConnection(userId, connectionInfo.userId);
    console.log('[AwardWallet] Connection created:', connection.id);

    // Perform initial sync of loyalty accounts
    try {
      const accounts = await getConnectedUser(connectionInfo.userId);
      await syncLoyaltyAccounts(connection.id, accounts);
      console.log('[AwardWallet] Initial sync completed:', accounts.length, 'accounts');
    } catch (syncError) {
      console.error('[AwardWallet] Initial sync failed (non-fatal):', syncError);
    }

    return NextResponse.redirect(successRedirect);
  } catch (error) {
    console.error('[AwardWallet] Callback error:', error);
    return NextResponse.redirect(errorRedirect);
  }
}
