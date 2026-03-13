import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { runFullTransactionImport } from '@/lib/thrivecart/transaction-import';

/**
 * POST /api/cron/thrivecart-full-import
 * Runs the full ThriveCart transaction import as a background job.
 * Triggered by QStash from the admin KPI import endpoint.
 * Protected by CRON_SECRET or QStash signature verification.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${serverEnv.CRON_SECRET}`;
  const isQStash = request.headers.get('upstash-signature');

  if (authHeader !== expectedToken && !isQStash) {
    console.error('[TC Full Import Worker] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[TC Full Import Worker] Starting full import...');

  try {
    const result = await runFullTransactionImport();

    console.log(
      `[TC Full Import Worker] Complete: ${result.totalFetched} fetched, ${result.totalInserted} inserted, ${result.totalSkipped} skipped, ${result.errors.length} errors`
    );

    return NextResponse.json({ success: result.errors.length === 0, ...result });
  } catch (error) {
    console.error('[TC Full Import Worker] Failed:', error);
    return NextResponse.json(
      { error: 'Import failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export const maxDuration = 800;
