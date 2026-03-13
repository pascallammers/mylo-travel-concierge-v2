import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { runFullTransactionImport } from '@/lib/thrivecart/transaction-import';

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
