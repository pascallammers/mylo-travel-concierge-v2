'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LoyaltyProgramCard } from './loyalty-program-card';
import { HugeiconsIcon } from '@hugeicons/react';
import { Wallet02Icon } from '@hugeicons/core-free-icons';
import { Loader2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';

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

/**
 * Abbreviates large numbers for compact display
 */
function abbreviateNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toLocaleString('de-DE');
}

/**
 * Compact header widget showing top loyalty programs
 * Click opens Settings to Loyalty tab
 * @param onOpenSettings - Callback to open settings with loyalty tab
 */
export function LoyaltyHeaderWidget({ onOpenSettings, className }: LoyaltyHeaderWidgetProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const { data, isLoading } = useQuery<AccountsResponse>({
    queryKey: ['awardwallet', 'accounts'],
    queryFn: async () => {
      const res = await fetch('/api/awardwallet/accounts');
      if (!res.ok) return { connected: false, lastSyncedAt: null, accounts: [] };
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Don't render anything while loading on first mount
  if (isLoading) {
    return null;
  }

  const isConnected = data?.connected ?? false;
  const accounts = data?.accounts ?? [];
  const topAccounts = accounts.slice(0, 3);

  // Not connected: Show connect button (desktop only, mobile is too crowded)
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
  if (topAccounts.length === 0) {
    return null;
  }

  // Mobile: Just show icon with total count
  if (isMobile) {
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

  // Desktop: Show popover with top accounts
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 px-2 gap-2 text-muted-foreground hover:text-foreground',
            className,
          )}
        >
          <HugeiconsIcon icon={Wallet02Icon} size={16} color="currentColor" strokeWidth={1.5} />
          <div className="flex items-center gap-1.5">
            {topAccounts.slice(0, 2).map((account, idx) => (
              <span
                key={account.id}
                className="text-xs font-medium whitespace-nowrap"
                title={`${account.providerName}: ${account.balance.toLocaleString()} ${account.balanceUnit}`}
              >
                {idx > 0 && <span className="text-muted-foreground/50 mr-1.5">·</span>}
                {abbreviateNumber(account.balance)}
              </span>
            ))}
            {accounts.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{accounts.length - 2}</span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Deine Treueprogramme</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              <Settings2 className="w-3.5 h-3.5 mr-1" />
              Verwalten
            </Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {topAccounts.map((account) => (
            <div key={account.id} className="px-3 py-2 border-b last:border-0">
              <LoyaltyProgramCard
                providerName={account.providerName}
                providerCode={account.providerCode}
                balance={account.balance}
                balanceUnit={account.balanceUnit}
                eliteStatus={account.eliteStatus}
                expirationDate={account.expirationDate ? new Date(account.expirationDate) : null}
                logoUrl={account.logoUrl}
                compact
              />
            </div>
          ))}
        </div>
        {accounts.length > 3 && (
          <div className="p-2 border-t bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              className="w-full h-7 text-xs"
            >
              Alle {accounts.length} Programme anzeigen
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
