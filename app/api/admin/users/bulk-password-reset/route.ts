import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin, getUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { user, subscription, verification, passwordResetHistory } from '@/lib/db/schema';
import { eq, desc, inArray, and, gt } from 'drizzle-orm';
import { sendPasswordResetEmail } from '@/lib/email';
import { buildResetPasswordUrl, resolveBaseUrl } from '@/lib/password-reset';
import crypto from 'crypto';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if a user has active subscription
 */
function hasActiveSubscription(
  sub: { status: string; currentPeriodEnd: Date } | null
): boolean {
  if (!sub) return false;
  const now = new Date();
  return sub.status === 'active' && sub.currentPeriodEnd > now;
}

/**
 * POST /api/admin/users/bulk-password-reset
 * Sends password reset emails to all users with active subscriptions
 * 
 * Rate-limited to 10 emails per second (Resend limit)
 * 
 * @returns { success: boolean, totalUsers: number, sent: number, failed: number, errors: Array }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Check if current user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    const currentUser = await getUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // 2. Get all users
    const allUsers = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
      })
      .from(user);

    // 3. Get all subscriptions
    const allSubscriptions = await db
      .select({
        userId: subscription.userId,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        createdAt: subscription.createdAt,
      })
      .from(subscription)
      .orderBy(desc(subscription.createdAt));

    // Create subscription map (most recent per user)
    const subscriptionMap = new Map<string, typeof allSubscriptions[0]>();
    for (const sub of allSubscriptions) {
      if (sub.userId && !subscriptionMap.has(sub.userId)) {
        subscriptionMap.set(sub.userId, sub);
      }
    }

    // 4. Filter to only active users
    const activeUsers = allUsers.filter((u) => {
      const userSub = subscriptionMap.get(u.id);
      return hasActiveSubscription(userSub ? {
        status: userSub.status,
        currentPeriodEnd: userSub.currentPeriodEnd,
      } : null);
    });

    if (activeUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active users found',
        totalUsers: 0,
        sent: 0,
        failed: 0,
        errors: [],
      });
    }

    // 5. Send emails in batches
    const baseUrl = resolveBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
    const errors: Array<{ email: string; error: string }> = [];
    let sent = 0;

    console.log(`📧 Starting bulk password reset for ${activeUsers.length} active users`);

    for (let i = 0; i < activeUsers.length; i += BATCH_SIZE) {
      const batch = activeUsers.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (targetUser) => {
        try {
          // Generate token
          const token = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

          // Store verification token
          await db.insert(verification).values({
            id: crypto.randomUUID(),
            identifier: targetUser.email,
            value: token,
            expiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Build reset URL and send email
          const resetUrl = buildResetPasswordUrl({
            baseUrl,
            token,
            email: targetUser.email,
          });

          const emailResult = await sendPasswordResetEmail(targetUser.email, resetUrl);
          const resendEmailId = emailResult?.data?.id || null;

          // Log to history with Resend email ID
          await db.insert(passwordResetHistory).values({
            userId: targetUser.id,
            sentBy: currentUser.id,
            triggerType: 'bulk',
            status: 'sent',
            resendEmailId,
          });

          return { success: true, email: targetUser.email, resendEmailId };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Log failed attempt to history
          await db.insert(passwordResetHistory).values({
            userId: targetUser.id,
            sentBy: currentUser.id,
            triggerType: 'bulk',
            status: 'failed',
            errorMessage,
          });

          return { success: false, email: targetUser.email, error: errorMessage };
        }
      });

      const results = await Promise.all(batchPromises);

      for (const result of results) {
        if (result.success) {
          sent++;
        } else {
          errors.push({ email: result.email, error: result.error || 'Unknown error' });
        }
      }

      // Rate limiting: wait between batches (except for last batch)
      if (i + BATCH_SIZE < activeUsers.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(`✅ Bulk password reset complete: ${sent} sent, ${errors.length} failed`);

    return NextResponse.json({
      success: true,
      message: `Password reset emails sent to ${sent} users`,
      totalUsers: activeUsers.length,
      sent,
      failed: errors.length,
      errors: errors.slice(0, 10), // Limit error details in response
    });
  } catch (error) {
    console.error('❌ Error in bulk password reset:', error);
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
 * GET /api/admin/users/bulk-password-reset
 * Returns count of active users that would receive emails
 */
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get all users
    const allUsers = await db
      .select({ id: user.id })
      .from(user);

    // Get all subscriptions
    const allSubscriptions = await db
      .select({
        userId: subscription.userId,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        createdAt: subscription.createdAt,
      })
      .from(subscription)
      .orderBy(desc(subscription.createdAt));

    // Create subscription map
    const subscriptionMap = new Map<string, typeof allSubscriptions[0]>();
    for (const sub of allSubscriptions) {
      if (sub.userId && !subscriptionMap.has(sub.userId)) {
        subscriptionMap.set(sub.userId, sub);
      }
    }

    // Count active users
    const activeCount = allUsers.filter((u) => {
      const userSub = subscriptionMap.get(u.id);
      return hasActiveSubscription(userSub ? {
        status: userSub.status,
        currentPeriodEnd: userSub.currentPeriodEnd,
      } : null);
    }).length;

    return NextResponse.json({
      success: true,
      activeUsers: activeCount,
    });
  } catch (error) {
    console.error('❌ Error getting active user count:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
