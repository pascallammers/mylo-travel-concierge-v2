import { NextRequest, NextResponse } from 'next/server';
import { isKpiAuthorized } from '@/lib/auth-utils';
import { Client as QStashClient } from '@upstash/qstash';
import { db } from '@/lib/db';
import { thriveCartImportState } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { serverEnv } from '@/env/server';

/**
 * GET /api/admin/kpi/import
 * Returns the current import status for polling during active imports.
 */
export async function GET(request: NextRequest) {
  try {
    const authorized = await isKpiAuthorized();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const rows = await db
      .select()
      .from(thriveCartImportState)
      .where(eq(thriveCartImportState.id, 'singleton'));

    const state = rows[0];
    return NextResponse.json({
      status: state?.status || 'unknown',
      lastImportAt: state?.lastImportAt?.toISOString() || null,
      totalImported: state?.totalImported || 0,
      lastError: state?.lastError || null,
    });
  } catch (error) {
    console.error('[KPI Import Status] Error:', error);
    return NextResponse.json({ status: 'unknown', error: 'Failed to fetch status' }, { status: 500 });
  }
}

/**
 * POST /api/admin/kpi/import
 * Triggers a full import via QStash background job and responds immediately.
 * The actual import runs in /api/cron/thrivecart-full-import.
 */
export async function POST(request: NextRequest) {
  try {
    const authorized = await isKpiAuthorized();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if import is already running
    const rows = await db
      .select()
      .from(thriveCartImportState)
      .where(eq(thriveCartImportState.id, 'singleton'));

    if (rows[0]?.status === 'running') {
      return NextResponse.json({
        success: false,
        error: 'Ein Import laeuft bereits. Bitte warte bis er abgeschlossen ist.',
      }, { status: 409 });
    }

    // Mark as running immediately
    await db
      .update(thriveCartImportState)
      .set({ status: 'running', lastImportAt: new Date(), lastError: 'Import gestartet...' })
      .where(eq(thriveCartImportState.id, 'singleton'));

    // Dispatch background job via QStash
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`;
    const qstash = new QStashClient({ token: serverEnv.QSTASH_TOKEN });

    await qstash.publishJSON({
      url: `${baseUrl}/api/cron/thrivecart-full-import`,
      headers: { authorization: `Bearer ${serverEnv.CRON_SECRET}` },
      retries: 0,
    });

    return NextResponse.json({
      success: true,
      message: 'Import gestartet. Fortschritt wird automatisch aktualisiert.',
    });
  } catch (error) {
    console.error('[KPI Import] Error dispatching import:', error);

    // Reset status on dispatch failure
    await db
      .update(thriveCartImportState)
      .set({ status: 'failed', lastError: 'Import konnte nicht gestartet werden.' })
      .where(eq(thriveCartImportState.id, 'singleton'));

    return NextResponse.json(
      { error: 'Import konnte nicht gestartet werden.', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
