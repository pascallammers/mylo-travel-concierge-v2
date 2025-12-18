import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { user, account, subscription } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendWelcomeEmail } from '@/lib/email';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * POST /api/admin/users/create
 * Creates a new user with account, subscription and sends welcome email
 * 
 * Body:
 * {
 *   "email": "user@example.com",
 *   "name": "John Doe",
 *   "subscriptionEndDate": "2026-01-18T00:00:00.000Z" // ISO date string
 * }
 * 
 * @requires Admin role
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, subscriptionEndDate } = body;

    // Validate required fields
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Gültige E-Mail Adresse erforderlich' }, { status: 400 });
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 });
    }

    if (!subscriptionEndDate) {
      return NextResponse.json({ error: 'Subscription End-Date erforderlich' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, email.toLowerCase().trim()),
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Ein User mit dieser E-Mail existiert bereits' }, { status: 409 });
    }

    // Generate secure random password (12 characters)
    const password = crypto.randomBytes(12).toString('base64').slice(0, 12);
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const endDate = new Date(subscriptionEndDate);

    const [newUser] = await db
      .insert(user)
      .values({
        id: userId,
        email: email.toLowerCase().trim(),
        name: name.trim(),
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        role: 'user',
        isActive: true,
        activationStatus: 'active',
      })
      .returning();

    // Create account with password
    const accountId = crypto.randomBytes(16).toString('hex');
    await db.insert(account).values({
      id: accountId,
      userId: newUser.id,
      accountId: email.toLowerCase().trim(),
      providerId: 'credential',
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });

    // Create subscription
    const subscriptionId = crypto.randomBytes(16).toString('hex');
    await db.insert(subscription).values({
      id: subscriptionId,
      userId: newUser.id,
      status: 'active',
      amount: 0,
      currency: 'EUR',
      recurringInterval: 'manual',
      currentPeriodStart: now,
      currentPeriodEnd: endDate,
      startedAt: now,
      createdAt: now,
      customerId: `manual_${userId}`,
      productId: 'manual_access',
      checkoutId: `admin_created_${Date.now()}`,
      planType: 'manual',
      planName: 'Admin Created Access',
    });

    // Send welcome email with credentials
    const firstName = name.split(' ')[0];
    try {
      await sendWelcomeEmail(email, password, firstName);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Return success but note email failure
      return NextResponse.json({
        success: true,
        userId: newUser.id,
        message: 'User erstellt, aber E-Mail konnte nicht gesendet werden',
        emailSent: false,
        temporaryPassword: password, // Return password so admin can share it manually
      });
    }

    return NextResponse.json({
      success: true,
      userId: newUser.id,
      message: 'User erstellt und Welcome-E-Mail gesendet',
      emailSent: true,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Server-Fehler' },
      { status: 500 }
    );
  }
}
