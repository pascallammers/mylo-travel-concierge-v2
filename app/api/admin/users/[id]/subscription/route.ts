import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { subscription, session } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { invalidateUserCaches } from '@/lib/performance-cache';
import { clearUserDataCache } from '@/lib/user-data-server';

/**
 * PATCH /api/admin/users/[id]/subscription
 * Update user subscription validity and status
 * @param id - User ID
 * Body: { validUntil?: Date, status?: 'active' | 'canceled' }
 * @returns Updated subscription
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: userId } = await params;
    const body = await request.json();

    // Get current subscription
    const currentSubscription = await db.query.subscription.findFirst({
      where: eq(subscription.userId, userId),
      orderBy: [desc(subscription.createdAt)],
    });

    if (!currentSubscription) {
      return NextResponse.json(
        { error: 'No subscription found for this user' },
        { status: 404 }
      );
    }

    // Validate and prepare updates
    const updates: Partial<typeof subscription.$inferInsert> = {
      modifiedAt: new Date(),
    };

    if (body.validUntil !== undefined) {
      const validUntil = new Date(body.validUntil);
      
      // Warn if setting to past date
      if (validUntil < new Date()) {
        console.warn(`⚠️ Setting subscription to past date for user ${userId}`);
        console.warn(`   User will NOT be able to log in after this change!`);
      }

      updates.currentPeriodEnd = validUntil;
      console.log(`📅 Updating subscription end date for user ${userId} to ${validUntil}`);
    }

    if (body.status !== undefined) {
      if (!['active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid'].includes(body.status)) {
        return NextResponse.json(
          { error: 'Invalid subscription status' },
          { status: 400 }
        );
      }
      updates.status = body.status;
      console.log(`📊 Updating subscription status for user ${userId} to ${body.status}`);
    }

    // Update subscription
    const [updatedSubscription] = await db
      .update(subscription)
      .set(updates)
      .where(eq(subscription.id, currentSubscription.id))
      .returning();

    if (!updatedSubscription) {
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      );
    }

    const shouldRevokeSessions =
      updatedSubscription.currentPeriodEnd <= new Date() ||
      ['incomplete', 'incomplete_expired', 'unpaid'].includes(updatedSubscription.status);

    if (shouldRevokeSessions) {
      await db.delete(session).where(eq(session.userId, userId));
      console.log(`🔒 Revoked all sessions for user ${userId} after subscription update`);
    }

    // Invalidate caches
    invalidateUserCaches(userId);
    clearUserDataCache(userId);

    console.log(`✅ Subscription updated for user ${userId}`);

    return NextResponse.json({
      success: true,
      subscription: updatedSubscription,
      warning: body.validUntil && new Date(body.validUntil) < new Date()
        ? 'User will not be able to log in with this expiration date in the past'
        : undefined,
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
