import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user, account } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendWelcomeEmail } from '@/lib/email';
import crypto from 'crypto';

// Webhook secret for security
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

/**
 * Webhook endpoint for user creation after product purchase
 * 
 * POST /api/webhooks/create-user
 * 
 * Body:
 * {
 *   "email": "kunde@example.com",
 *   "firstName": "Max",     // Optional
 *   "lastName": "Mustermann", // Optional
 *   "webhookSecret": "your-secret-key"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "userId": "...",
 *   "message": "User created and welcome email sent"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, firstName, lastName, webhookSecret } = body;

    // 1. Validate webhook secret
    if (!WEBHOOK_SECRET) {
      console.error('❌ WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (webhookSecret !== WEBHOOK_SECRET) {
      console.warn('⚠️ Invalid webhook secret attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // 3. Check if user already exists
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, email),
    });

    if (existingUser) {
      console.log('ℹ️ User already exists:', email);
      return NextResponse.json(
        {
          message: 'User already exists',
          userId: existingUser.id,
          alreadyExists: true,
        },
        { status: 200 },
      );
    }

    // 4. Generate secure random password (12 characters)
    const password = crypto.randomBytes(12).toString('base64').slice(0, 12);

    // 5. Create user in database
    const userId = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    
    const [newUser] = await db
      .insert(user)
      .values({
        id: userId,
        email,
        name: firstName && lastName ? `${firstName} ${lastName}` : firstName || email.split('@')[0],
        emailVerified: true, // Auto-verified since created via webhook
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    console.log('✅ User created:', newUser.id, email);

    // 6. Create account entry for email/password auth
    // Note: Better Auth will handle password hashing automatically when user logs in
    // We store the plain password temporarily to send via email
    const accountId = crypto.randomBytes(16).toString('hex');
    
    await db.insert(account).values({
      id: accountId,
      userId: newUser.id,
      accountId: email,
      providerId: 'credential',
      password: password, // Better Auth will hash this on first login
      createdAt: now,
      updatedAt: now,
    });

    console.log('✅ Account entry created for user:', newUser.id);

    // 7. Send welcome email with login credentials
    try {
      await sendWelcomeEmail(email, password, firstName);
      console.log('✅ Welcome email sent to:', email);
    } catch (emailError) {
      console.error('❌ Failed to send welcome email:', emailError);
      // Don't fail the request if email fails
      return NextResponse.json(
        {
          success: true,
          userId: newUser.id,
          message: 'User created but email failed to send',
          emailError: true,
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        userId: newUser.id,
        message: 'User created and welcome email sent',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('❌ Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
