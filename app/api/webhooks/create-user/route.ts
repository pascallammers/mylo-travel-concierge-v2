import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user, account, subscription, payment } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendWelcomeEmail } from '@/lib/email';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

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
 *   "firstName": "Max",           // Optional
 *   "lastName": "Mustermann",     // Optional
 *   "orderId": "37313646",        // ThriveCart Order ID (recommended)
 *   "customerId": "12345",        // ThriveCart Customer ID (optional)
 *   "amount": 4900,               // Amount in cents (optional)
 *   "currency": "EUR",            // Currency code (optional, default: EUR)
 *   "productName": "MYLO Miles",  // Product name (optional)
 *   "webhookSecret": "your-secret-key"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "userId": "...",
 *   "subscriptionId": "...",
 *   "message": "User created and welcome email sent"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      email, 
      firstName, 
      lastName, 
      orderId,
      customerId,
      amount,
      currency = 'EUR',
      productName,
      webhookSecret 
    } = body;

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

    // 3. Check if user already exists (case-insensitive)
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, normalizedEmail),
    });

    if (existingUser) {
      console.log('ℹ️ User already exists:', normalizedEmail);
      
      // Check if they have an active subscription, if not create one
      const existingSubscription = await db.query.subscription.findFirst({
        where: eq(subscription.userId, existingUser.id),
      });
      
      if (!existingSubscription && orderId) {
        // User exists but no subscription - create one (e.g., they re-purchased)
        const subscriptionId = crypto.randomBytes(16).toString('hex');
        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + 30);
        
        await db.insert(subscription).values({
          id: subscriptionId,
          userId: existingUser.id,
          status: 'active',
          amount: amount || 0,
          currency: currency,
          recurringInterval: 'month',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          startedAt: periodStart,
          createdAt: periodStart,
          customerId: customerId || normalizedEmail,
          productId: 'mylo-subscription',
          checkoutId: orderId || crypto.randomBytes(8).toString('hex'),
          thrivecardCustomerId: customerId || null,
          thrivecardSubscriptionId: orderId || null,
          planType: 'standard',
          planName: productName || 'MYLO Miles & Travel Concierge',
          lastPaymentDate: periodStart,
          nextPaymentDate: periodEnd,
        });
        
        console.log('✅ Subscription created for existing user:', existingUser.id);
      }
      
      return NextResponse.json(
        {
          message: 'User already exists',
          userId: existingUser.id,
          subscriptionId: existingSubscription?.id || 'created',
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
        email: normalizedEmail,
        name: firstName && lastName ? `${firstName} ${lastName}` : firstName || normalizedEmail.split('@')[0],
        emailVerified: true, // Auto-verified since created via webhook
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    console.log('✅ User created:', newUser.id, normalizedEmail);

    // 6. Create account entry for email/password auth
    // Hash password with bcrypt before storing
    const accountId = crypto.randomBytes(16).toString('hex');
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    await db.insert(account).values({
      id: accountId,
      userId: newUser.id,
      accountId: normalizedEmail,
      providerId: 'credential',
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });

    console.log('✅ Account entry created for user:', newUser.id);

    // 7. Create subscription for the new user (30 days access)
    const subscriptionId = crypto.randomBytes(16).toString('hex');
    const periodStart = now;
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    await db.insert(subscription).values({
      id: subscriptionId,
      userId: newUser.id,
      status: 'active',
      amount: amount || 0,
      currency: currency,
      recurringInterval: 'month',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      startedAt: periodStart,
      createdAt: periodStart,
      customerId: customerId || normalizedEmail,
      productId: 'mylo-subscription',
      checkoutId: orderId || crypto.randomBytes(8).toString('hex'),
      thrivecardCustomerId: customerId || null,
      thrivecardSubscriptionId: orderId || null,
      planType: 'standard',
      planName: productName || 'MYLO Miles & Travel Concierge',
      lastPaymentDate: periodStart,
      nextPaymentDate: periodEnd,
    });

    console.log('✅ Subscription created:', subscriptionId, 'valid until:', periodEnd);

    // 8. Record the initial payment (if amount provided)
    if (amount || orderId) {
      const paymentId = crypto.randomBytes(16).toString('hex');
      await db.insert(payment).values({
        id: paymentId,
        createdAt: now,
        updatedAt: now,
        userId: newUser.id,
        totalAmount: amount || 0,
        currency: currency,
        status: 'succeeded',
        thrivecardPaymentId: orderId || null,
        thrivecardCustomerId: customerId || null,
        paymentProvider: 'thrivecart',
        webhookSource: 'zapier',
        metadata: JSON.stringify({
          event: 'initial_purchase',
          productName: productName || null,
          processedAt: now.toISOString(),
        }),
      });
      console.log('✅ Initial payment recorded:', paymentId);
    }

    // 9. Send welcome email with login credentials
    try {
      await sendWelcomeEmail(normalizedEmail, password, firstName);
      console.log('✅ Welcome email sent to:', normalizedEmail);
    } catch (emailError) {
      console.error('❌ Failed to send welcome email:', emailError);
      // Don't fail the request if email fails
      return NextResponse.json(
        {
          success: true,
          userId: newUser.id,
          subscriptionId: subscriptionId,
          message: 'User created but email failed to send',
          emailError: true,
        },
        { status: 201 },
      );
    }

    console.log('🎉 User creation complete:', normalizedEmail);

    return NextResponse.json(
      {
        success: true,
        userId: newUser.id,
        subscriptionId: subscriptionId,
        message: 'User created with subscription and welcome email sent',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('❌ Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
