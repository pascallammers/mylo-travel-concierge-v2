import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { user, subscription } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { invalidateUserCaches } from '@/lib/performance-cache';
import { clearUserDataCache } from '@/lib/user-data-server';

/**
 * GET /api/admin/users/[id]
 * Get single user details with subscription info
 * @param id - User ID
 * @returns User details with subscription data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const userId = params.id;

    // Get user data
    const userData = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get subscription data
    const userSubscription = await db.query.subscription.findFirst({
      where: eq(subscription.userId, userId),
      orderBy: [desc(subscription.createdAt)],
    });

    return NextResponse.json({
      user: userData,
      subscription: userSubscription || null,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update user details
 * @param id - User ID
 * Body: { name?, email?, role?, isActive?, activationStatus? }
 * @returns Updated user
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const userId = params.id;
    const body = await request.json();

    // Validate input
    const updates: Partial<typeof user.$inferInsert> = {};
    
    if (body.name !== undefined) updates.name = body.name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.role !== undefined && ['user', 'admin'].includes(body.role)) {
      updates.role = body.role;
    }
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.activationStatus !== undefined && 
        ['active', 'inactive', 'grace_period', 'suspended'].includes(body.activationStatus)) {
      updates.activationStatus = body.activationStatus;
    }

    updates.updatedAt = new Date();

    // Update user
    const [updatedUser] = await db
      .update(user)
      .set(updates)
      .where(eq(user.id, userId))
      .returning();

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Invalidate caches
    invalidateUserCaches(userId);
    clearUserDataCache(userId);

    console.log(`✅ User ${userId} updated by admin:`, updates);

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Deactivate user (soft delete)
 * @param id - User ID
 * @returns Success message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const userId = params.id;

    // Soft delete: set isActive = false and activationStatus = 'suspended'
    const [deactivatedUser] = await db
      .update(user)
      .set({
        isActive: false,
        activationStatus: 'suspended',
        deactivatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
      .returning();

    if (!deactivatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Invalidate caches
    invalidateUserCaches(userId);
    clearUserDataCache(userId);

    console.log(`✅ User ${userId} deactivated by admin`);

    return NextResponse.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
