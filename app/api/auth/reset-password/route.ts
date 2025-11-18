import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user, account, verification } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/reset-password
 * Custom password reset confirmation endpoint
 * Validates token and updates password directly in database
 * Industry-standard pattern used by Express, Rails, Django
 * @body { token: string, newPassword: string }
 * @returns { success: boolean, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    console.log('🔐 Password reset confirmation called');
    console.log('🎫 Token (first 8 chars):', token?.substring(0, 8) + '...');

    // 1. Validate input
    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Token und Passwort erforderlich' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'Passwort muss mindestens 8 Zeichen lang sein' },
        { status: 400 }
      );
    }

    // 2. Find verification token in database
    const verificationRecord = await db.query.verification.findFirst({
      where: eq(verification.value, token),
    });

    if (!verificationRecord) {
      console.log('❌ Token not found in database');
      return NextResponse.json(
        { success: false, message: 'Ungültiger oder abgelaufener Reset-Link' },
        { status: 400 }
      );
    }

    console.log('✅ Token found in database');
    console.log('📧 Identifier (email):', verificationRecord.identifier);

    // 3. Check if token is expired
    if (new Date() > verificationRecord.expiresAt) {
      console.log('❌ Token expired');
      // Delete expired token
      await db.delete(verification).where(eq(verification.id, verificationRecord.id));
      
      return NextResponse.json(
        { success: false, message: 'Reset-Link ist abgelaufen. Bitte fordere einen neuen an.' },
        { status: 400 }
      );
    }

    console.log('✅ Token is valid and not expired');

    // 4. Find user by email (identifier)
    const targetUser = await db.query.user.findFirst({
      where: eq(user.email, verificationRecord.identifier),
      columns: { id: true, email: true },
    });

    if (!targetUser) {
      console.log('❌ User not found for email:', verificationRecord.identifier);
      return NextResponse.json(
        { success: false, message: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    console.log('✅ User found:', targetUser.id);

    // 5. Hash the new password with bcrypt (same as Better-Auth: salt 10)
    console.log('🔒 Hashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('✅ Password hashed successfully');

    // 6. Update password in account table (Better-Auth stores passwords here)
    console.log('💾 Updating password in database...');
    
    // Better-Auth stores passwords in the account table with providerId 'credential'
    const accountRecord = await db.query.account.findFirst({
      where: and(
        eq(account.userId, targetUser.id),
        eq(account.providerId, 'credential')
      ),
    });

    if (!accountRecord) {
      console.log('❌ No credential account found for user');
      return NextResponse.json(
        { success: false, message: 'Kein Passwort-Login für diesen Benutzer gefunden' },
        { status: 404 }
      );
    }

    await db
      .update(account)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(account.id, accountRecord.id));

    console.log('✅ Password updated in database');

    // 7. Delete the used token (prevent reuse)
    await db.delete(verification).where(eq(verification.id, verificationRecord.id));
    console.log('🗑️ Token deleted from database');

    return NextResponse.json({
      success: true,
      message: 'Passwort erfolgreich zurückgesetzt',
    });
  } catch (error) {
    console.error('❌ Error in custom reset-password endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Fehler beim Zurücksetzen des Passworts. Bitte versuche es später erneut.',
      },
      { status: 500 }
    );
  }
}
