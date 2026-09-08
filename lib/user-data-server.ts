import 'server-only';

import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { subscription, user } from './db/schema';
import { db } from './db';
import { auth } from './auth';
import { headers } from 'next/headers';
import { getPaymentsByUserId } from './db/queries';
import { doesSubscriptionGrantAccess } from './subscription-access';

export type ComprehensiveUserData = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  role: 'user' | 'admin';
  isProUser: boolean;
  subscriptionStatus: 'active' | 'canceled' | 'expired' | 'none';
  /** The subscription row that currently grants access, if any. */
  subscription?: {
    id: string;
    productId: string;
    status: string;
    amount: number;
    currency: string;
    recurringInterval: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
  };
  paymentHistory: any[];
};

const userDataCache = new Map<string, { data: ComprehensiveUserData; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedUserData(userId: string): ComprehensiveUserData | null {
  const cached = userDataCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  if (cached) {
    userDataCache.delete(userId);
  }
  return null;
}

function setCachedUserData(userId: string, data: ComprehensiveUserData): void {
  userDataCache.set(userId, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearUserDataCache(userId: string): void {
  userDataCache.delete(userId);
}

export function clearAllUserDataCache(): void {
  userDataCache.clear();
}

type SubscriptionRow = typeof subscription.$inferSelect;

const byPeriodEndDesc = (a: SubscriptionRow, b: SubscriptionRow) =>
  new Date(b.currentPeriodEnd).getTime() - new Date(a.currentPeriodEnd).getTime();

/**
 * Get comprehensive user data with React.cache() for request deduplication.
 * Multiple calls within the same request will only execute once.
 */
export const getComprehensiveUserData = cache(async (): Promise<ComprehensiveUserData | null> => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return null;
    }

    const userId = session.user.id;

    const cached = getCachedUserData(userId);
    if (cached) {
      return cached;
    }

    const [userData, subscriptions, paymentHistory] = await Promise.all([
      db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .then((rows) => rows[0]),
      db.select().from(subscription).where(eq(subscription.userId, userId)).$withCache(),
      getPaymentsByUserId({ userId }),
    ]);

    if (!userData) {
      return null;
    }

    const now = new Date();
    const latestSubscription = [...subscriptions].sort(byPeriodEndDesc)[0];
    const activeSubscription = subscriptions
      .filter((sub) => doesSubscriptionGrantAccess(sub, now))
      .sort(byPeriodEndDesc)[0];

    let isProUser = false;
    let subscriptionStatus: ComprehensiveUserData['subscriptionStatus'] = 'none';
    const isAccountActive =
      userData.role === 'admin' ||
      (userData.isActive !== false && (!userData.activationStatus || userData.activationStatus === 'active'));

    if (isAccountActive && activeSubscription) {
      isProUser = true;
      subscriptionStatus =
        activeSubscription.status === 'canceled' || activeSubscription.cancelAtPeriodEnd ? 'canceled' : 'active';
    } else if (latestSubscription) {
      const isExpired = new Date(latestSubscription.currentPeriodEnd) <= now;
      const isCanceled = latestSubscription.status === 'canceled' || latestSubscription.cancelAtPeriodEnd;

      if (isExpired) {
        subscriptionStatus = 'expired';
      } else if (isCanceled) {
        subscriptionStatus = 'canceled';
      }
    }

    // Admins keep platform access even without a paid subscription.
    if (userData.role === 'admin') {
      isProUser = true;
    }

    const comprehensiveData: ComprehensiveUserData = {
      id: userData.id,
      email: userData.email,
      emailVerified: userData.emailVerified,
      name: userData.name || userData.email.split('@')[0],
      image: userData.image,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      role: (userData.role as 'user' | 'admin') || 'user',
      isProUser,
      subscriptionStatus,
      paymentHistory,
    };

    if (activeSubscription) {
      comprehensiveData.subscription = {
        id: activeSubscription.id,
        productId: activeSubscription.productId,
        status: activeSubscription.status,
        amount: activeSubscription.amount,
        currency: activeSubscription.currency,
        recurringInterval: activeSubscription.recurringInterval,
        currentPeriodStart: activeSubscription.currentPeriodStart,
        currentPeriodEnd: activeSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd,
        canceledAt: activeSubscription.canceledAt,
      };
    }

    setCachedUserData(userId, comprehensiveData);

    return comprehensiveData;
  } catch (error) {
    console.error('Error getting comprehensive user data:', error);
    return null;
  }
});

export async function isUserPro(): Promise<boolean> {
  const userData = await getComprehensiveUserData();
  return userData?.isProUser || false;
}
