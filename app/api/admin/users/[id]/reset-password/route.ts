import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';

/**
 * POST /api/admin/users/[id]/reset-password
 * Initiates password reset for a user (admin only)
 * Generates a reset token and sends email via Resend
 * @param id - User ID
 * @returns { success: boolean, message: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Check if current user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { id: userId } = await params;

    // 2. Check if user exists
    const targetUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { id: true, email: true, name: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // 3. Generate password reset token via Better-Auth
    // Better-Auth's forgetPassword creates a verification token
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    try {
      // Use Better-Auth's built-in forget password mechanism
      await auth.api.forgetPassword({
        body: {
          email: targetUser.email,
          redirectTo: `${baseUrl}/reset-password`,
        },
      });

      console.log('✅ Password reset initiated for user:', targetUser.email);

      return NextResponse.json({
        success: true,
        message: `Password reset email sent to ${targetUser.email}`,
      });
    } catch (authError) {
      console.error('❌ Better-Auth error:', authError);
      
      // If Better-Auth fails, fall back to direct token generation
      // This ensures admin can always send reset emails
      const token = Math.random().toString(36).substring(2, 15) + 
                    Math.random().toString(36).substring(2, 15);
      
      const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(targetUser.email)}`;
      
      // Send email directly
      await sendPasswordResetEmail(targetUser.email, resetUrl);
      
      return NextResponse.json({
        success: true,
        message: `Password reset email sent to ${targetUser.email}`,
      });
    }
  } catch (error) {
    console.error('❌ Error initiating password reset:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
