'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useCachedUserData } from '@/hooks/use-cached-user-data';
import { type ComprehensiveUserData } from '@/lib/user-data';

interface UserContextType {
  // Core user data
  user: ComprehensiveUserData | null | undefined;
  isLoading: boolean;
  error: any;
  refetch: () => void;
  isRefetching: boolean;

  // Quick access to commonly used properties
  isProUser: boolean;
  subscriptionStatus: string;
  subscription: ComprehensiveUserData['subscription'];
  paymentHistory: any[];

  // Rate limiting helpers
  shouldCheckLimits: boolean | undefined;
  shouldBypassLimitsForModel: (selectedModel: string) => boolean;

  // Subscription status checks
  hasActiveSubscription: boolean;
  isSubscriptionCanceled: boolean;
  isSubscriptionExpired: boolean;
  hasNoSubscription: boolean;

  // Legacy shape still read by navbar, chat-interface, form-component and settings-dialog
  subscriptionData: any;

  // Additional utilities
  isCached: boolean;
  clearCache: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const userData = useCachedUserData();

  return <UserContext.Provider value={userData}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);

  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }

  return context;
}

// Convenience hooks for specific data
export function useIsProUser() {
  const { isProUser, isLoading } = useUser();
  return { isProUser, isLoading };
}

export function useSubscriptionStatus() {
  const {
    subscriptionStatus,
    hasActiveSubscription,
    isSubscriptionCanceled,
    isSubscriptionExpired,
    hasNoSubscription,
    isLoading,
  } = useUser();

  return {
    subscriptionStatus,
    hasActiveSubscription,
    isSubscriptionCanceled,
    isSubscriptionExpired,
    hasNoSubscription,
    isLoading,
  };
}
