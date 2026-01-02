'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoyaltyConnectButton, AwardWalletSignupHint } from './connect-button';
import { LoyaltyProgramsList } from './loyalty-programs-list';
import { HugeiconsIcon } from '@hugeicons/react';
import { Wallet02Icon } from '@hugeicons/core-free-icons';
import { AlertTriangleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';

interface SettingsSectionProps {
  className?: string;
}

/**
 * Complete settings section for AwardWallet integration
 * Shows connect flow when not connected, programs list when connected
 * Handles error states from callback redirect
 */
export function LoyaltySettingsSection({ className }: SettingsSectionProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const searchParams = useSearchParams();
  const [showError, setShowError] = useState(false);

  // Check for error from OAuth callback
  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'connection_failed') {
      setShowError(true);
    }
  }, [searchParams]);

  const { data, isLoading } = useQuery<{ connected: boolean }>({
    queryKey: ['awardwallet', 'accounts'],
    queryFn: async () => {
      const res = await fetch('/api/awardwallet/accounts');
      if (!res.ok) return { connected: false };
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const isConnected = data?.connected ?? false;

  // Handle disconnect to refresh state
  const handleDisconnected = () => {
    // Query will be invalidated by the list component
  };

  return (
    <div className={cn('space-y-4', isMobile ? 'space-y-3' : 'space-y-4', className)}>
      <div>
        <h3 className={cn('font-semibold mb-1', isMobile ? 'text-sm' : 'text-base')}>
          Treueprogramme
        </h3>
        <p className={cn('text-muted-foreground', isMobile ? 'text-[11px] leading-relaxed' : 'text-xs')}>
          {isConnected
            ? 'Deine verbundenen Treueprogramme und Punktestände.'
            : 'Verbinde dein AwardWallet-Konto, um alle deine Meilen und Punkte an einem Ort zu sehen.'}
        </p>
      </div>

      {showError && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Die Verbindung zu AwardWallet konnte nicht hergestellt werden. Bitte versuche es erneut.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center bg-muted/10">
          <div className="flex flex-col items-center space-y-3">
            <div className="p-3 rounded-full bg-muted animate-pulse">
              <HugeiconsIcon
                icon={Wallet02Icon}
                size={28}
                color="currentColor"
                strokeWidth={1.5}
                className="text-muted-foreground"
              />
            </div>
            <div className="space-y-1">
              <div className="h-4 w-32 bg-muted rounded animate-pulse mx-auto" />
              <div className="h-3 w-48 bg-muted rounded animate-pulse mx-auto" />
            </div>
          </div>
        </div>
      ) : isConnected ? (
        <LoyaltyProgramsList onDisconnected={handleDisconnected} />
      ) : (
        <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center bg-muted/10">
          <div className="flex flex-col items-center space-y-3">
            <div className="p-3 rounded-full bg-muted">
              <HugeiconsIcon
                icon={Wallet02Icon}
                size={28}
                color="currentColor"
                strokeWidth={1.5}
                className="text-muted-foreground"
              />
            </div>
            <div className="space-y-1">
              <h4 className="font-medium text-sm">AwardWallet verbinden</h4>
              <p className="text-muted-foreground text-xs max-w-sm">
                Verbinde dein AwardWallet-Konto, um deine Treueprogramm-Salden zu synchronisieren.
              </p>
            </div>
            <LoyaltyConnectButton size="sm" className="mt-2" />
            <AwardWalletSignupHint className="mt-2" />
          </div>
        </div>
      )}
    </div>
  );
}
