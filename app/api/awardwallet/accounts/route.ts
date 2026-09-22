import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getUserLoyaltyData } from '@/lib/db/queries/awardwallet';
import { ChatSDKError } from '@/lib/errors';
import { classifyLoyaltyAccount } from '@/lib/loyalty/account-state';

const AccountResponseSchema = z.object({
  /** @deprecated Prefer `status`. Kept for back-compat with existing UI. */
  connected: z.boolean(),
  status: z.enum(['connected', 'error', 'disconnected']),
  awPlan: z.enum(['free', 'plus']).nullable(),
  lastSyncedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  accounts: z.array(
    z.object({
      id: z.string(),
      providerCode: z.string(),
      providerName: z.string(),
      balance: z.number().nullable(),
      balanceUnit: z.enum(['miles', 'points']),
      lastRetrievedAt: z.string().nullable(),
      state: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('current') }),
        z.object({ kind: z.literal('stale'), days: z.number() }),
        z.object({ kind: z.literal('no_balance') }),
        z.object({ kind: z.literal('needs_repair'), code: z.number() }),
        z.object({ kind: z.literal('read_failed'), code: z.number() }),
      ]),
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
 * @param request - Incoming request with session headers
 * @returns Account states and the connected user's AwardWallet plan
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
      status: loyaltyData.status,
      awPlan: loyaltyData.awPlan,
      lastSyncedAt: loyaltyData.lastSyncedAt?.toISOString() ?? null,
      lastError: loyaltyData.lastError,
      accounts: loyaltyData.accounts.map((acc) => ({
        id: acc.id,
        providerCode: acc.providerCode,
        providerName: acc.providerName,
        balance: acc.balance,
        balanceUnit: acc.balanceUnit,
        lastRetrievedAt: acc.lastRetrievedAt?.toISOString() ?? null,
        state: classifyLoyaltyAccount(acc, new Date()),
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
