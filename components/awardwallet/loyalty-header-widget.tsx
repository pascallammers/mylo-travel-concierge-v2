'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HugeiconsIcon } from '@hugeicons/react';
import { Wallet02Icon } from '@hugeicons/core-free-icons';
import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import Image from 'next/image';

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

interface LoyaltyHeaderWidgetProps {
  onOpenSettings?: () => void;
  className?: string;
}

interface LoyaltyHeaderBannerProps {
  onOpenSettings?: () => void;
  className?: string;
}

/**
 * Formats balance with locale-aware number formatting (full numbers, not abbreviated)
 */
function formatFullBalance(num: number): string {
  return num.toLocaleString('de-DE');
}

/**
 * Custom hook to fetch loyalty accounts data
 */
function useLoyaltyAccounts() {
  return useQuery<AccountsResponse>({
    queryKey: ['awardwallet', 'accounts'],
    queryFn: async () => {
      const res = await fetch('/api/awardwallet/accounts');
      if (!res.ok) return { connected: false, lastSyncedAt: null, accounts: [] };
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

/**
 * Horizontal banner showing all loyalty programs with full details
 * Displays in the top area with scrollable list of all programs
 */
export function LoyaltyHeaderBanner({ onOpenSettings, className }: LoyaltyHeaderBannerProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { data, isLoading } = useLoyaltyAccounts();

  if (isLoading) {
    return (
      <div className={cn('h-10 animate-pulse bg-muted/30 rounded-lg', className)} />
    );
  }

  const isConnected = data?.connected ?? false;
  const accounts = data?.accounts ?? [];

  if (!isConnected || accounts.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl',
        'bg-gradient-to-r from-zinc-900/90 via-zinc-800/80 to-zinc-900/90',
        'border border-zinc-700/50 backdrop-blur-sm',
        'shadow-lg shadow-black/20',
        className
      )}
    >
      {/* Scrollable programs list */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
        {accounts.map((account, index) => (
          <div
            key={account.id}
            className={cn(
              'flex items-center gap-2 shrink-0',
              'group cursor-default',
              index !== accounts.length - 1 && 'pr-3 border-r border-zinc-700/50'
            )}
          >
            {/* Logo */}
            {account.logoUrl ? (
              <Image
                src={account.logoUrl}
                alt={account.providerName}
                width={20}
                height={20}
                className="rounded object-contain shrink-0"
                unoptimized
              />
            ) : (
              <div className="w-5 h-5 rounded bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-300 shrink-0">
                {account.providerCode.slice(0, 2).toUpperCase()}
              </div>
            )}

            {/* Program name and balance */}
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[120px]">
                {account.providerName}
              </span>
              <span className="text-xs font-semibold text-zinc-100 tabular-nums">
                {formatFullBalance(account.balance)}{' '}
                <span className="text-zinc-500 font-normal text-[10px]">
                  {account.balanceUnit}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Settings button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            className="h-7 w-7 p-0 shrink-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          Treueprogramme verwalten
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Compact header widget for navbar (icon only)
 * Click opens Settings to Loyalty tab
 */
export function LoyaltyHeaderWidget({ onOpenSettings, className }: LoyaltyHeaderWidgetProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { data, isLoading } = useLoyaltyAccounts();

  if (isLoading) {
    return null;
  }

  const isConnected = data?.connected ?? false;
  const accounts = data?.accounts ?? [];

  // Not connected: Show connect button (desktop only)
  if (!isConnected) {
    if (isMobile) return null;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            className={cn('h-8 px-2 text-muted-foreground hover:text-foreground', className)}
          >
            <HugeiconsIcon icon={Wallet02Icon} size={16} color="currentColor" strokeWidth={1.5} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          Treueprogramme verbinden
        </TooltipContent>
      </Tooltip>
    );
  }

  // No accounts yet
  if (accounts.length === 0) {
    return null;
  }

  // Show icon with total count badge
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettings}
          className={cn('h-8 px-2 relative', className)}
        >
          <HugeiconsIcon icon={Wallet02Icon} size={16} color="currentColor" strokeWidth={1.5} />
          <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-medium rounded-full w-4 h-4 flex items-center justify-center">
            {accounts.length}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {accounts.length} Treueprogramme
      </TooltipContent>
    </Tooltip>
  );
}
