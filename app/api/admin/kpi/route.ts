import { NextRequest, NextResponse } from 'next/server';
import { isKpiAuthorized } from '@/lib/auth-utils';
import { computeKPIs, DATE_RANGES, type DateRange } from '@/lib/thrivecart/kpi';

/**
 * GET /api/admin/kpi?range=this_month
 * Returns business KPIs computed from ThriveCart transaction data.
 * Restricted to authorized email addresses only.
 * @param range - One of: this_month, last_month, this_year, last_year, all_time
 */
export async function GET(request: NextRequest) {
  try {
    const authorized = await isKpiAuthorized();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const rangeParam = request.nextUrl.searchParams.get('range') || 'this_month';
    const dateRange: DateRange = DATE_RANGES.includes(rangeParam as DateRange)
      ? (rangeParam as DateRange)
      : 'this_month';

    const kpis = await computeKPIs(dateRange);
    return NextResponse.json(kpis);
  } catch (error) {
    console.error('[KPI API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to compute KPIs', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
