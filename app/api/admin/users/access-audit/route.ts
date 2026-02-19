import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { getAccessAuditReport, revokeSessionsForUsers } from '@/lib/admin/access-audit';
import { clearUserDataCache } from '@/lib/user-data-server';
import { invalidateUserCaches } from '@/lib/performance-cache';

/**
 * GET /api/admin/users/access-audit
 * Returns blocked users that still have live sessions.
 * @returns Access audit summary and issue list.
 */
export async function GET() {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const report = await getAccessAuditReport();
    return NextResponse.json(report);
  } catch (error) {
    console.error('Error building access audit report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/users/access-audit
 * Revokes sessions for all currently flagged blocked users.
 * @returns Number of revoked sessions and affected users.
 */
export async function POST() {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const report = await getAccessAuditReport();
    const affectedUserIds = [...new Set(report.issues.map((issue) => issue.userId))];
    const revokedSessions = await revokeSessionsForUsers(affectedUserIds);

    for (const userId of affectedUserIds) {
      invalidateUserCaches(userId);
      clearUserDataCache(userId);
    }

    return NextResponse.json({
      success: true,
      affectedUsers: affectedUserIds.length,
      revokedSessions,
      remainingIssues: 0,
    });
  } catch (error) {
    console.error('Error revoking sessions for access audit issues:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
