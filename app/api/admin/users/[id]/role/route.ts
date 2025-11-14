import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin, updateUserRole, type UserRole } from '@/lib/auth-utils';

/**
 * PUT /api/admin/users/[id]/role
 * Updates a user's role
 * Body: { role: 'user' | 'admin' }
 * Requires admin role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check if user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id: userId } = await params;

    // Parse request body
    const body = await request.json();
    const { role } = body;

    // Validate role
    if (!role || !['user', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "user" or "admin"' },
        { status: 400 },
      );
    }

    // Update user role
    const updatedUser = await updateUserRole(userId, role as UserRole);

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
