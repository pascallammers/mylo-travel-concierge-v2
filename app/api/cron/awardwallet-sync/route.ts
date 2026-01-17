import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { getConnectedUser } from '@/lib/api/awardwallet-client';
import {
  getActiveConnections,
  syncLoyaltyAccounts,
  updateConnectionStatus,
} from '@/lib/db/queries/awardwallet';

interface SyncResult {
  userId: string;
  status: 'success' | 'failed';
  accountCount?: number;
  error?: string;
}

/**
 * POST /api/cron/awardwallet-sync
 * Scheduled sync for all active AwardWallet connections
 * Runs every 6 hours via Vercel Cron
 */
export async function POST(request: NextRequest) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${serverEnv.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    console.error('[AwardWallet Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[AwardWallet Cron] Starting scheduled sync');
  const startTime = Date.now();

  const results: SyncResult[] = [];
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const connections = await getActiveConnections();
    console.log(`[AwardWallet Cron] Found ${connections.length} active connections`);

    for (const connection of connections) {
      try {
        const accounts = await getConnectedUser(connection.awUserId);
        const accountCount = await syncLoyaltyAccounts(connection.id, accounts);

        results.push({
          userId: connection.userId,
          status: 'success',
          accountCount,
        });
        syncedCount++;

        console.log(`[AwardWallet Cron] Synced user ${connection.userId}: ${accountCount} accounts`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await updateConnectionStatus(connection.id, 'error', errorMessage);

        results.push({
          userId: connection.userId,
          status: 'failed',
          error: errorMessage,
        });
        failedCount++;

        console.error(`[AwardWallet Cron] Failed to sync user ${connection.userId}:`, errorMessage);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[AwardWallet Cron] Completed in ${duration}ms: ${syncedCount} synced, ${failedCount} failed`,
    );

    return NextResponse.json({
      success: true,
      syncedConnections: syncedCount,
      failedConnections: failedCount,
      duration,
      details: results,
    });
  } catch (error) {
    console.error('[AwardWallet Cron] Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
