'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LoyaltyProgramCard } from './loyalty-program-card';
import { AlertTriangle, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LoyaltyAccount {
  id: string;
  providerCode: string;
  providerName: string;
  balance: number;
  balanceUnit: string;
  eliteStatus?: string | null;
  expirationDate?: string | null;
  logoUrl?: string | null;
}

type LoyaltyDataStatus = 'connected' | 'error' | 'disconnected';

interface AccountsResponse {
  /** @deprecated Prefer `status`. Retained while older clients are in flight. */
  connected: boolean;
  status?: LoyaltyDataStatus;
  lastSyncedAt: string | null;
  lastError?: string | null;
  accounts: LoyaltyAccount[];
}

interface ApiErrorResponse {
  message?: unknown;
  cause?: unknown;
}

interface LoyaltyProgramsListProps {
  onDisconnected?: () => void;
  className?: string;
}

function getApiErrorMessage(payload: ApiErrorResponse, fallback: string): string {
  if (typeof payload.cause === 'string' && payload.cause.length > 0) {
    return payload.cause;
  }

  if (typeof payload.message === 'string' && payload.message.length > 0) {
    return payload.message;
  }

  return fallback;
}

/**
 * Formats the last synced timestamp for display (uses translations from parent)
 */
function formatLastSynced(dateStr: string | null, t: ReturnType<typeof useTranslations>): string {
  if (!dateStr) return t('neverSynced');
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return t('justNow');
  if (diffMins < 60) return t('minutesAgo', { count: diffMins });

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t('hoursAgo', { count: diffHours });

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * List component for displaying all loyalty programs with refresh and disconnect
 * @param onDisconnected - Callback when user disconnects AwardWallet
 */
export function LoyaltyProgramsList({ onDisconnected, className }: LoyaltyProgramsListProps) {
  const queryClient = useQueryClient();
  const t = useTranslations('loyalty');
  const tCommon = useTranslations('common');
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<AccountsResponse>({
    queryKey: ['awardwallet', 'accounts'],
    queryFn: async () => {
      const res = await fetch('/api/awardwallet/accounts');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(err, t('loadError')));
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/awardwallet/sync', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(err, t('syncFailed')));
      }
      return res.json();
    },
    onSuccess: (result) => {
      toast.success(t('programsSynced', { count: result.accountCount }));
      queryClient.invalidateQueries({ queryKey: ['awardwallet', 'accounts'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/awardwallet/disconnect', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(err, t('disconnectError')));
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t('disconnected'));
      queryClient.invalidateQueries({ queryKey: ['awardwallet'] });
      setShowDisconnectDialog(false);
      onDisconnected?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-sm text-destructive mb-3">
          {error instanceof Error ? error.message : t('loadErrorShort')}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
          {t('retry')}
        </Button>
      </div>
    );
  }

  // Sync-error path: the user *does* have a connection, but the last sync
  // failed. We must NOT render the "not connected" empty state — that gas-
  // lights the user. Show a red banner + retry CTA instead, so the failure
  // is visible and recoverable.
  const status: LoyaltyDataStatus =
    data?.status ?? (data?.connected ? 'connected' : 'disconnected');

  if (status === 'error') {
    const lastSyncedLabel = formatLastSynced(data?.lastSyncedAt ?? null, t);
    return (
      <div className={cn('space-y-3', className)}>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-destructive">
              {t('syncErrorTitle', { lastSynced: lastSyncedLabel })}
            </p>
            <p className="text-xs text-muted-foreground">{t('syncErrorDescription')}</p>
            {data?.lastError ? (
              <p className="text-xs text-muted-foreground/80 font-mono break-all">
                {data.lastError}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
            )}
            {t('refresh')}
          </Button>
        </div>
      </div>
    );
  }

  if (status !== 'connected' || !data) {
    return null;
  }

  const accounts = data.accounts;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {formatLastSynced(data.lastSyncedAt, t)}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="h-7 px-2"
        >
          {syncMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span className="ml-1.5 text-xs">{t('refresh')}</span>
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed rounded-lg bg-muted/10">
          <p className="text-sm text-muted-foreground">
            {t('noPrograms')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('addPrograms')}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
          {accounts.map((account) => (
            <LoyaltyProgramCard
              key={account.id}
              providerName={account.providerName}
              providerCode={account.providerCode}
              balance={account.balance}
              balanceUnit={account.balanceUnit}
              eliteStatus={account.eliteStatus}
              expirationDate={account.expirationDate ? new Date(account.expirationDate) : null}
              logoUrl={account.logoUrl}
            />
          ))}
        </div>
      )}

      <div className="pt-2 border-t">
        <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Unplug className="w-3.5 h-3.5 mr-2" />
              {t('disconnect')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('disconnectTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('disconnectDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {disconnectMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    {t('disconnecting')}
                  </>
                ) : (
                  t('confirmDisconnect')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
