import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { runFullSync, deactivateExpiredUsers } from '@/lib/thrivecart/sync';

/**
 * GET|POST /api/cron/thrivecart-sync
 * Scheduled sync for all ThriveCart subscriptions.
 * Also deactivates users with expired subscriptions.
 * Runs every 6 hours via Vercel Cron, which invokes the path with GET;
 * POST stays for manual triggers.
 */
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${serverEnv.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    console.error('[ThriveCart Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[ThriveCart Cron] Starting scheduled sync...');

  try {
    // 1. Sync with ThriveCart first so active rebills extend periodEnd
    const result = await runFullSync();

    // 2. Only then deactivate users whose period is still expired
    const deactivated = await deactivateExpiredUsers();

    return NextResponse.json({
      success: true,
      deactivatedExpired: deactivated,
      ...result,
    });
  } catch (error) {
    console.error('[ThriveCart Cron] Sync failed:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export const maxDuration = 300; // 5 minute timeout for large user bases
