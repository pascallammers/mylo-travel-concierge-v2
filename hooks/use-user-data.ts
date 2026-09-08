import { useQuery } from '@tanstack/react-query';
import { getCurrentUserBootstrapData } from '@/app/user-actions';
import { type ComprehensiveUserData } from '@/lib/user-data';
import { shouldBypassRateLimits } from '@/ai/providers';

export function useUserData() {
  const {
    data: userData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['comprehensive-user-data'],
    queryFn: getCurrentUserBootstrapData,
    staleTime: 1000 * 60 * 30, // 30 minutes - matches server cache
    gcTime: 1000 * 60 * 60, // 1 hour cache retention
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const shouldBypassLimitsForModel = (selectedModel: string) => {
    return shouldBypassRateLimits(selectedModel, userData);
  };

  return {
    user: userData,
    isLoading,
    error,
    refetch,
    isRefetching,

    isProUser: Boolean(userData?.isProUser),
    subscriptionStatus: userData?.subscriptionStatus || 'none',
    subscription: userData?.subscription,
    paymentHistory: userData?.paymentHistory || [],

    shouldCheckLimits: !isLoading && userData && !userData.isProUser,
    shouldBypassLimitsForModel,

    hasActiveSubscription: userData?.subscriptionStatus === 'active',
    isSubscriptionCanceled: userData?.subscriptionStatus === 'canceled',
    isSubscriptionExpired: userData?.subscriptionStatus === 'expired',
    hasNoSubscription: userData?.subscriptionStatus === 'none',

    // Legacy shape still read by navbar, chat-interface, form-component and settings-dialog
    subscriptionData: userData?.subscription
      ? {
          hasSubscription: true,
          subscription: userData.subscription,
        }
      : { hasSubscription: false },
  };
}

// Lightweight hook for components that only need to know if user is pro
export function useIsProUser() {
  const { isProUser, isLoading } = useUserData();
  return { isProUser, isLoading };
}

// Hook for components that need subscription status but not all user data
export function useSubscriptionStatus() {
  const {
    subscriptionStatus,
    hasActiveSubscription,
    isSubscriptionCanceled,
    isSubscriptionExpired,
    hasNoSubscription,
    isLoading,
  } = useUserData();

  return {
    subscriptionStatus,
    hasActiveSubscription,
    isSubscriptionCanceled,
    isSubscriptionExpired,
    hasNoSubscription,
    isLoading,
  };
}

// Export the comprehensive type for components that need it
export type { ComprehensiveUserData };
