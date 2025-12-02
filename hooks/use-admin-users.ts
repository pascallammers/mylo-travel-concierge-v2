import { useQuery } from '@tanstack/react-query';
import { useDebouncedCallback } from 'use-debounce';
import { useState, useCallback } from 'react';

/**
 * User data structure returned by the admin users API
 */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  registeredAt: string;
  lastLogin: string | null;
  activeDays: number;
  sessions: number;
  tokensUsed: number;
  subscriptionStatus: 'active' | 'inactive' | 'cancelled' | 'none';
  subscriptionPlan: string | null;
  subscriptionValidUntil: string | null;
  isActive?: boolean | null;
  activationStatus?: 'active' | 'inactive' | 'grace_period' | 'suspended' | null;
}

/**
 * API response structure for admin users endpoint
 */
export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Fetches users from the admin API
 * @param page - Page number for pagination
 * @param search - Search query for filtering users
 * @param limit - Number of users per page
 */
async function fetchAdminUsers(
  page: number,
  search: string,
  limit: number = 50
): Promise<AdminUsersResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (search) {
    params.set('search', search);
  }

  const response = await fetch(`/api/admin/users?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return response.json();
}

/**
 * Hook configuration options
 */
interface UseAdminUsersOptions {
  /** Initial page number (default: 1) */
  initialPage?: number;
  /** Initial search query (default: '') */
  initialSearch?: string;
  /** Number of users per page (default: 50) */
  limit?: number;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
}

/**
 * Custom hook for managing admin user list with TanStack Query and live search.
 * 
 * Features:
 * - Automatic caching with 2 minute stale time
 * - Debounced live search (300ms default)
 * - Pagination support
 * - Background refetching indicators
 * - Smooth transitions with placeholder data
 * 
 * @example
 * ```tsx
 * const {
 *   data,
 *   isLoading,
 *   isFetching,
 *   search,
 *   setSearch,
 *   page,
 *   setPage,
 *   refetch,
 * } = useAdminUsers();
 * 
 * // Live search - just update the search value
 * <input value={search} onChange={(e) => setSearch(e.target.value)} />
 * ```
 */
export function useAdminUsers(options: UseAdminUsersOptions = {}) {
  const {
    initialPage = 1,
    initialSearch = '',
    limit = 50,
    debounceMs = 300,
  } = options;

  // Local state for immediate UI updates
  const [search, setSearchValue] = useState(initialSearch);
  // Debounced search value that triggers API calls
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  // Current page
  const [page, setPageValue] = useState(initialPage);

  // Debounced setter for search - delays API calls while typing
  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearch(value);
    setPageValue(1); // Reset to first page on new search
  }, debounceMs);

  // Public search setter - updates UI immediately, debounces API call
  const setSearch = useCallback((value: string) => {
    setSearchValue(value); // Update input immediately
    debouncedSetSearch(value); // Debounce the actual search
  }, [debouncedSetSearch]);

  // Public page setter
  const setPage = useCallback((newPage: number) => {
    setPageValue(newPage);
  }, []);

  // TanStack Query for data fetching
  const query = useQuery({
    queryKey: ['admin-users', page, debouncedSearch, limit],
    queryFn: () => fetchAdminUsers(page, debouncedSearch, limit),
    staleTime: 1000 * 60 * 2, // 2 minutes - data is considered fresh
    gcTime: 1000 * 60 * 5, // 5 minutes - keep in cache
    refetchOnWindowFocus: false, // Admin panel doesn't need aggressive refetch
    placeholderData: (previousData) => previousData, // Smooth transitions
  });

  // Computed values for convenience
  const totalPages = query.data ? Math.ceil(query.data.total / limit) : 0;
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    // Query data
    data: query.data,
    users: query.data?.users ?? [],
    total: query.data?.total ?? 0,
    
    // Loading states
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    
    // Search state
    search,
    setSearch,
    debouncedSearch,
    isSearching: search !== debouncedSearch,
    
    // Pagination state
    page,
    setPage,
    limit,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    
    // Actions
    refetch: query.refetch,
    
    // Navigation helpers
    nextPage: useCallback(() => {
      if (hasNextPage) setPageValue((p) => p + 1);
    }, [hasNextPage]),
    previousPage: useCallback(() => {
      if (hasPreviousPage) setPageValue((p) => p - 1);
    }, [hasPreviousPage]),
  };
}
