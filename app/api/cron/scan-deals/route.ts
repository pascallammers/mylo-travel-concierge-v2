import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { runDealScan } from '@/lib/services/deal-scanner';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${serverEnv.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    console.error('[DealScan Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[DealScan Cron] Starting scheduled scan...');

  try {
    const result = await runDealScan();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[DealScan Cron] Scan failed:', error);
    return NextResponse.json(
      { error: 'Scan failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}

export const maxDuration = 300;
