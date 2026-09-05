import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { runIncrementalSync } from '@/lib/thrivecart/transaction-import';

/**
 * GET|POST /api/cron/thrivecart-transactions
 * Daily incremental sync of ThriveCart transactions for KPI dashboard.
 * Runs once per day via Vercel Cron, which invokes the path with GET;
 * POST stays for manual triggers.
 */
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${serverEnv.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[TC Transactions Cron] Starting incremental sync...');

  try {
    const result = await runIncrementalSync();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[TC Transactions Cron] Failed:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export const maxDuration = 120;
