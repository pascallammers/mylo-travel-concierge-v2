import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type AccessAuditReason =
  | 'account_inactive'
  | 'no_subscription'
  | 'subscription_expired'
  | 'subscription_status_blocked';

export interface AdminAccessAuditIssue {
  userId: string;
  name: string;
  email: string;
  reason: AccessAuditReason;
  liveSessionCount: number;
  latestSessionExpiry: string | null;
  isActive: boolean | null;
  activationStatus: string | null;
  subscriptionStatus: string | null;
  subscriptionValidUntil: string | null;
}

export interface AdminAccessAuditSummary {
  checkedUsers: number;
  blockedUsers: number;
  blockedWithLiveSessions: number;
  liveSessionsOnBlockedUsers: number;
  generatedAt: string;
}

export interface AdminAccessAuditResponse {
  summary: AdminAccessAuditSummary;
  issues: AdminAccessAuditIssue[];
}

interface AccessAuditRevokeResponse {
  success: boolean;
  affectedUsers: number;
  revokedSessions: number;
  remainingIssues: number;
}

/**
 * Loads the current admin access audit report.
 * @returns The current access audit report.
 */
async function fetchAdminAccessAudit(): Promise<AdminAccessAuditResponse> {
  const response = await fetch('/api/admin/users/access-audit');
  if (!response.ok) {
    throw new Error('Failed to load access audit');
  }

  return response.json() as Promise<AdminAccessAuditResponse>;
}

/**
 * Revokes sessions for all currently flagged blocked users.
 * @returns Result with revoked session count.
 */
async function revokeFlaggedSessions(): Promise<AccessAuditRevokeResponse> {
  const response = await fetch('/api/admin/users/access-audit', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to revoke flagged sessions');
  }

  return response.json() as Promise<AccessAuditRevokeResponse>;
}

/**
 * Provides admin access-audit data and cleanup action.
 * @returns Query state plus mutation for session cleanup.
 */
export function useAdminAccessAudit() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-access-audit'],
    queryFn: fetchAdminAccessAudit,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeFlaggedSessions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-access-audit'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  return {
    data: query.data,
    summary: query.data?.summary,
    issues: query.data?.issues ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    revokeSessions: revokeMutation.mutateAsync,
    isRevoking: revokeMutation.isPending,
  };
}
