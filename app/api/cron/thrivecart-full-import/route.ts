import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/env/server';
import { runFullTransactionImport } from '@/lib/thrivecart/transaction-import';

/**
 * POST /api/cron/thrivecart-full-import
 * Runs the full ThriveCart transaction import as a background job.
 * Triggered by QStash from the admin KPI import endpoint, which forwards the
 * CRON_SECRET bearer token; that token is the only accepted credential.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${serverEnv.CRON_SECRET}`) {
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
