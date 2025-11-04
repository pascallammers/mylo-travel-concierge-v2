/**
 * Feature Flags Configuration
 * 
 * Centralized feature flag management for gradual rollouts and A/B testing
 */

export type FeatureFlag = 
  | 'FLIGHT_SEARCH'
  | 'EXTREME_SEARCH'
  | 'MEMORY_COMPANION'
  | 'CONNECTORS';

export interface FeatureConfig {
  enabled: boolean;
  description: string;
  requiresAuth?: boolean;
  requiresPro?: boolean;
}

/**
 * Feature flag configuration
 * All flags default to false for safety
 */
const FEATURE_FLAGS: Record<FeatureFlag, FeatureConfig> = {
  FLIGHT_SEARCH: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH === 'true',
    description: 'Enable flight search tool with Seats.aero and Amadeus integration',
    requiresAuth: false,
    requiresPro: false,
  },
  EXTREME_SEARCH: {
    enabled: true, // Already in production
    description: 'Enable extreme search with deep research capabilities',
    requiresAuth: true,
    requiresPro: false,
  },
  MEMORY_COMPANION: {
    enabled: true, // Already in production
    description: 'Enable memory companion for personal context storage',
    requiresAuth: true,
    requiresPro: false,
  },
  CONNECTORS: {
    enabled: true, // Already in production
    description: 'Enable connectors for Google Drive and other integrations',
    requiresAuth: true,
    requiresPro: true,
  },
};

/**
 * Check if a feature is enabled
 * 
 * @param feature - The feature flag to check
 * @returns true if feature is enabled, false otherwise
 */
export function isFeatureEnabled(feature: FeatureFlag): boolean {
  return FEATURE_FLAGS[feature]?.enabled ?? false;
}

/**
 * Get feature configuration
 * 
 * @param feature - The feature flag to get config for
 * @returns Feature configuration object
 */
export function getFeatureConfig(feature: FeatureFlag): FeatureConfig | null {
  return FEATURE_FLAGS[feature] ?? null;
}

/**
 * Check if user has access to feature based on auth and subscription requirements
 * 
 * @param feature - The feature flag to check
 * @param isAuthenticated - Whether user is authenticated
 * @param isPro - Whether user has pro subscription
 * @returns true if user has access, false otherwise
 */
export function hasFeatureAccess(
  feature: FeatureFlag,
  isAuthenticated: boolean = false,
  isPro: boolean = false
): boolean {
  const config = getFeatureConfig(feature);
  
  if (!config || !config.enabled) {
    return false;
  }

  if (config.requiresAuth && !isAuthenticated) {
    return false;
  }

  if (config.requiresPro && !isPro) {
    return false;
  }

  return true;
}

/**
 * Get all enabled features
 * 
 * @returns Array of enabled feature flags
 */
export function getEnabledFeatures(): FeatureFlag[] {
  return Object.entries(FEATURE_FLAGS)
    .filter(([_, config]) => config.enabled)
    .map(([feature]) => feature as FeatureFlag);
}

/**
 * Get feature flag status for debugging
 * Only available in development/staging
 */
export function getFeatureFlagStatus(): Record<FeatureFlag, boolean> {
  if (process.env.NODE_ENV === 'production') {
    return {} as Record<FeatureFlag, boolean>;
  }

  return Object.entries(FEATURE_FLAGS).reduce(
    (acc, [feature, config]) => ({
      ...acc,
      [feature]: config.enabled,
    }),
    {} as Record<FeatureFlag, boolean>
  );
}
