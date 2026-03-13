import { NextRequest, NextResponse } from 'next/server';
import { isKpiAuthorized } from '@/lib/auth-utils';
import { computeKPIs } from '@/lib/thrivecart/kpi';

/**
 * GET /api/admin/kpi
 * Returns business KPIs computed from ThriveCart transaction data.
 * Restricted to authorized email addresses only.
 */
export async function GET(request: NextRequest) {
  try {
    const authorized = await isKpiAuthorized();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const kpis = await computeKPIs();
    return NextResponse.json(kpis);
  } catch (error) {
    console.error('[KPI API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to compute KPIs', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
