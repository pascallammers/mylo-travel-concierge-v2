'use client';

import { useEffect } from 'react';
import { useUserData } from '@/hooks/use-user-data';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { type ComprehensiveUserData } from '@/lib/user-data';
import { shouldBypassRateLimits } from '@/ai/providers';

export function useCachedUserData() {
  // Get fresh data from the existing hook
  const { user: freshUser, isLoading: isFreshLoading, error, refetch, isRefetching, ...otherUserData } = useUserData();

  // Cache user data in localStorage
  const [cachedUser, setCachedUser] = useLocalStorage<ComprehensiveUserData | null>('scira-user-data', null);

  // Update cache when fresh data is available
  useEffect(() => {
    if (freshUser && !isFreshLoading) {
      setCachedUser(freshUser);
    }
  }, [freshUser, isFreshLoading, setCachedUser]);

  // Clear cache when user logs out (no fresh user and not loading)
  useEffect(() => {
    if (!freshUser && !isFreshLoading && cachedUser) {
      setCachedUser(null);
    }
  }, [freshUser, isFreshLoading, cachedUser, setCachedUser]);

  // Use cached data if available, otherwise use fresh data
  const user = cachedUser || freshUser;

  // Show loading only if we have no cached data and fresh data is loading
  const isLoading = !cachedUser && isFreshLoading;

  // Recalculate derived properties based on current user data
  const isProUser = Boolean(user?.isProUser);
  const subscriptionStatus = user?.subscriptionStatus || 'none';

  const shouldBypassLimitsForModel = (selectedModel: string) => {
    return shouldBypassRateLimits(selectedModel, user);
  };

  return {
    user,
    isLoading,
    error,
    refetch,
    isRefetching,

    isProUser,
    subscriptionStatus,
    subscription: user?.subscription,
    paymentHistory: user?.paymentHistory || [],

    shouldCheckLimits: Boolean(!isLoading && user && !user.isProUser),
    shouldBypassLimitsForModel,

    hasActiveSubscription: user?.subscriptionStatus === 'active',
    isSubscriptionCanceled: user?.subscriptionStatus === 'canceled',
    isSubscriptionExpired: user?.subscriptionStatus === 'expired',
    hasNoSubscription: user?.subscriptionStatus === 'none',

    // Legacy shape still read by navbar, chat-interface, form-component and settings-dialog
    subscriptionData: user?.subscription
      ? {
          hasSubscription: true,
          subscription: user.subscription,
        }
      : { hasSubscription: false },

    isCached: Boolean(cachedUser),
    clearCache: () => setCachedUser(null),
  };
}

// Lightweight hook for components that only need to know if user is pro
export function useCachedIsProUser() {
  const { isProUser, isLoading } = useCachedUserData();
  return { isProUser, isLoading };
}

// Hook for components that need subscription status but not all user data
export function useCachedSubscriptionStatus() {
  const {
    subscriptionStatus,
    hasActiveSubscription,
    isSubscriptionCanceled,
    isSubscriptionExpired,
    hasNoSubscription,
    isLoading,
  } = useCachedUserData();

  return {
    subscriptionStatus,
    hasActiveSubscription,
    isSubscriptionCanceled,
    isSubscriptionExpired,
    hasNoSubscription,
    isLoading,
  };
}
