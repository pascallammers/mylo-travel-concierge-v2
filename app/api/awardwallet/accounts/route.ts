import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getUserLoyaltyData } from '@/lib/db/queries/awardwallet';
import { ChatSDKError } from '@/lib/errors';

const AccountResponseSchema = z.object({
  connected: z.boolean(),
  lastSyncedAt: z.string().nullable(),
  accounts: z.array(
    z.object({
      id: z.string(),
      providerCode: z.string(),
      providerName: z.string(),
      balance: z.number(),
      balanceUnit: z.enum(['miles', 'points', 'nights', 'credits']),
      eliteStatus: z.string().nullable(),
      expirationDate: z.string().nullable(),
      accountNumber: z.string().nullable(),
      logoUrl: z.string().nullable(),
    }),
  ),
});

export type AccountsResponse = z.infer<typeof AccountResponseSchema>;

/**
 * GET /api/awardwallet/accounts
 * Returns user's loyalty accounts sorted by balance
 */
export async function GET(request: NextRequest) {
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

    const loyaltyData = await getUserLoyaltyData(session.user.id);

    const response: AccountsResponse = {
      connected: loyaltyData.connected,
      lastSyncedAt: loyaltyData.lastSyncedAt?.toISOString() ?? null,
      accounts: loyaltyData.accounts.map((acc) => ({
        id: acc.id,
        providerCode: acc.providerCode,
        providerName: acc.providerName,
        balance: acc.balance,
        balanceUnit: acc.balanceUnit,
        eliteStatus: acc.eliteStatus,
        expirationDate: acc.expirationDate?.toISOString() ?? null,
        accountNumber: acc.accountNumber,
        logoUrl: acc.logoUrl,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AwardWallet] Accounts error:', error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return NextResponse.json(
      {
        code: 'bad_request:api',
        message: 'Failed to fetch loyalty accounts',
      },
      { status: 500 },
    );
  }
}
