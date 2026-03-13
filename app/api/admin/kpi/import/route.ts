import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { runFullTransactionImport } from '@/lib/thrivecart/transaction-import';
import { db } from '@/lib/db';
import { thriveCartImportState } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/admin/kpi/import
 * Returns the current import status for polling during active imports.
 */
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
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
 * Triggers a full import of all ThriveCart transactions.
 * Admin-only. Should be called once for initial setup.
 */
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await runFullTransactionImport();

    return NextResponse.json({
      success: result.errors.length === 0,
      ...result,
    });
  } catch (error) {
    console.error('[KPI Import] Error:', error);
    return NextResponse.json(
      { error: 'Import failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export const maxDuration = 300; // 5 min for full import
