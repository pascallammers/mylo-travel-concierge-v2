import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { runFullSync } from '@/lib/thrivecart/sync';

/**
 * POST /api/cron/thrivecart-sync
 * Scheduled sync for all ThriveCart subscriptions.
 * Runs every 6 hours via Vercel Cron.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${serverEnv.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    console.error('[ThriveCart Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[ThriveCart Cron] Starting scheduled sync...');

  try {
    const result = await runFullSync();

    return NextResponse.json({
      success: true,
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
