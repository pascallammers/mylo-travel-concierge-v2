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
import { Loader2, RefreshCw, Unplug } from 'lucide-react';
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

interface AccountsResponse {
  connected: boolean;
  lastSyncedAt: string | null;
  accounts: LoyaltyAccount[];
}

interface LoyaltyProgramsListProps {
  onDisconnected?: () => void;
  className?: string;
}

/**
 * Formats the last synced timestamp for display
 */
function formatLastSynced(dateStr: string | null): string {
  if (!dateStr) return 'Noch nie synchronisiert';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `Vor ${diffMins} Minute${diffMins !== 1 ? 'n' : ''}`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Vor ${diffHours} Stunde${diffHours !== 1 ? 'n' : ''}`;

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
        throw new Error(err.message || 'Fehler beim Laden der Treueprogramme');
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
        throw new Error(err.message || 'Synchronisation fehlgeschlagen');
      }
      return res.json();
    },
    onSuccess: (result) => {
      toast.success(`${result.accountCount} Programme synchronisiert`);
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
        throw new Error(err.message || 'Verbindung konnte nicht getrennt werden');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('AwardWallet-Verbindung wurde getrennt');
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
          {error instanceof Error ? error.message : 'Fehler beim Laden'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (!data?.connected) {
    return null;
  }

  const accounts = data.accounts || [];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {formatLastSynced(data.lastSyncedAt)}
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
          <span className="ml-1.5 text-xs">Aktualisieren</span>
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed rounded-lg bg-muted/10">
          <p className="text-sm text-muted-foreground">
            Keine Treueprogramme in deinem AwardWallet-Konto gefunden.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Füge Programme in AwardWallet hinzu, um sie hier zu sehen.
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
              AwardWallet-Verbindung trennen
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Verbindung trennen?</AlertDialogTitle>
              <AlertDialogDescription>
                Wenn du die Verbindung trennst, werden alle synchronisierten Treueprogramm-Daten
                aus MYLO entfernt. Du kannst dich jederzeit wieder verbinden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {disconnectMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Trennen...
                  </>
                ) : (
                  'Ja, trennen'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
