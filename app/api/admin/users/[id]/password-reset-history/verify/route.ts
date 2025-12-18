import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { passwordResetHistory, user } from '@/lib/db/schema';
import { eq, isNotNull, and, isNull } from 'drizzle-orm';
import { getEmailStatus } from '@/lib/email';

/**
 * POST /api/admin/users/[id]/password-reset-history/verify
 * Verifies a single email status with Resend
 * 
 * @body { historyId: string } - Password reset history entry ID
 * @returns { success: boolean, status: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { id: userId } = await params;
    const body = await request.json();
    const { historyId } = body;

    if (!historyId) {
      return NextResponse.json(
        { success: false, message: 'historyId is required' },
        { status: 400 }
      );
    }

    // Get the history entry
    const historyEntry = await db.query.passwordResetHistory.findFirst({
      where: and(
        eq(passwordResetHistory.id, historyId),
        eq(passwordResetHistory.userId, userId)
      ),
    });

    if (!historyEntry) {
      return NextResponse.json(
        { success: false, message: 'History entry not found' },
        { status: 404 }
      );
    }

    if (!historyEntry.resendEmailId) {
      return NextResponse.json({
        success: true,
        status: 'no_email_id',
        message: 'No Resend email ID stored for this entry',
      });
    }

    // Get status from Resend
    const emailStatus = await getEmailStatus(historyEntry.resendEmailId);

    if (!emailStatus) {
      return NextResponse.json({
        success: false,
        message: 'Could not retrieve email status from Resend',
      });
    }

    // Update the history entry with the status
    const resendStatus = emailStatus.last_event || 'pending';
    await db
      .update(passwordResetHistory)
      .set({
        resendStatus,
        resendVerifiedAt: new Date(),
      })
      .where(eq(passwordResetHistory.id, historyId));

    return NextResponse.json({
      success: true,
      status: resendStatus,
      verifiedAt: new Date().toISOString(),
      emailDetails: {
        to: emailStatus.to,
        createdAt: emailStatus.created_at,
      },
    });
  } catch (error) {
    console.error('❌ Error verifying email status:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/users/[id]/password-reset-history/verify
 * Batch verify all unverified emails for a user
 * 
 * @returns { success: boolean, verified: number, results: Array }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { id: userId } = await params;

    // Check if user exists
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Get all history entries with resend email ID but not yet verified
    const unverifiedEntries = await db.query.passwordResetHistory.findMany({
      where: and(
        eq(passwordResetHistory.userId, userId),
        isNotNull(passwordResetHistory.resendEmailId),
        isNull(passwordResetHistory.resendVerifiedAt)
      ),
    });

    if (unverifiedEntries.length === 0) {
      return NextResponse.json({
        success: true,
        verified: 0,
        message: 'No unverified entries found',
        results: [],
      });
    }

    const results: Array<{
      id: string;
      resendEmailId: string;
      status: string;
      success: boolean;
    }> = [];

    for (const entry of unverifiedEntries) {
      if (!entry.resendEmailId) continue;

      try {
        const emailStatus = await getEmailStatus(entry.resendEmailId);
        const resendStatus = emailStatus?.last_event || 'pending';

        await db
          .update(passwordResetHistory)
          .set({
            resendStatus,
            resendVerifiedAt: new Date(),
          })
          .where(eq(passwordResetHistory.id, entry.id));

        results.push({
          id: entry.id,
          resendEmailId: entry.resendEmailId,
          status: resendStatus,
          success: true,
        });
      } catch (err) {
        results.push({
          id: entry.id,
          resendEmailId: entry.resendEmailId,
          status: 'error',
          success: false,
        });
      }
    }

    const verified = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      verified,
      total: unverifiedEntries.length,
      results,
    });
  } catch (error) {
    console.error('❌ Error batch verifying email status:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
