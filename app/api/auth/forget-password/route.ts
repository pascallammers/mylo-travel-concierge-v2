import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user, verification } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendPasswordResetEmail, type EmailLocale } from '@/lib/email';
import crypto from 'crypto';
import { buildResetPasswordUrl, resolveBaseUrl } from '@/lib/password-reset';

/**
 * POST /api/auth/forget-password
 * Custom password reset endpoint that guarantees email sending via Resend
 * Bypasses Better-Auth's forgetPassword to ensure direct email delivery
 * @body { email: string }
 * @returns { success: boolean, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, locale: bodyLocale } = body;
    const locale: EmailLocale = bodyLocale === 'de' ? 'de' : 'en';

    console.log('🔐 Custom forget-password endpoint called');
    console.log('📧 Email:', email);

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'E-Mail-Adresse erforderlich' },
        { status: 400 }
      );
    }

    // 1. Check if user exists
    const targetUser = await db.query.user.findFirst({
      where: eq(user.email, email.toLowerCase()),
      columns: { id: true, email: true, name: true },
    });

    // Security: Always return success even if user doesn't exist
    // This prevents email enumeration attacks
    if (!targetUser) {
      console.log('⚠️ User not found, but returning success (security)');
      return NextResponse.json({
        success: true,
        message: 'Falls diese E-Mail-Adresse registriert ist, wurde ein Reset-Link gesendet.',
      });
    }

    console.log('✅ User found:', targetUser.id);

    // 2. Generate secure reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    console.log('🎫 Generated token (first 8 chars):', token.substring(0, 8) + '...');
    console.log('⏰ Token expires at:', expiresAt);

    // 3. Store verification token in database
    // Note: Better-Auth's verification table uses 'identifier' (email) to link to user
    await db.insert(verification).values({
      id: crypto.randomUUID(), // Generate unique ID for verification record
      identifier: targetUser.email,
      value: token,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('💾 Token stored in database');

    // 4. Build reset URL
    const baseUrl = resolveBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
    const resetUrl = buildResetPasswordUrl({
      baseUrl,
      token,
      email: targetUser.email,
    });

    console.log('🔗 Reset URL generated:', resetUrl.substring(0, 50) + '...');

    // 5. Send email via Resend (GUARANTEED)
    console.log('📤 Sending email via Resend...');
    await sendPasswordResetEmail(targetUser.email, resetUrl, locale);

    console.log('✅ Password reset email sent successfully via custom route');

    return NextResponse.json({
      success: true,
      message: 'Falls diese E-Mail-Adresse registriert ist, wurde ein Reset-Link gesendet.',
    });
  } catch (error) {
    console.error('❌ Error in custom forget-password endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Fehler beim Senden der E-Mail. Bitte versuche es später erneut.',
      },
      { status: 500 }
    );
  }
}
