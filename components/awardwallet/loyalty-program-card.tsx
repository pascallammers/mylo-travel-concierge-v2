'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { AlertTriangleIcon } from 'lucide-react';

interface LoyaltyProgramCardProps {
  providerName: string;
  providerCode: string;
  balance: number;
  balanceUnit: string;
  eliteStatus?: string | null;
  expirationDate?: Date | null;
  logoUrl?: string | null;
  compact?: boolean;
  className?: string;
}

/**
 * Formats balance with locale-aware number formatting
 */
function formatBalance(balance: number): string {
  return balance.toLocaleString('de-DE');
}

/**
 * Checks if expiration date is within the warning threshold (6 months)
 */
function isExpiringSoon(date: Date | null | undefined): boolean {
  if (!date) return false;
  const now = new Date();
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  return date <= sixMonthsFromNow && date > now;
}

/**
 * Formats expiration date for display
 */
function formatExpirationDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Card component displaying a single loyalty program
 * @param providerName - Name of the loyalty program provider
 * @param providerCode - Unique code for the provider
 * @param balance - Current balance
 * @param balanceUnit - Unit of balance (miles, points, etc.)
 * @param eliteStatus - Optional elite tier status
 * @param expirationDate - Optional expiration date for the balance
 * @param logoUrl - Optional URL for provider logo
 * @param compact - Whether to use compact display mode
 */
export function LoyaltyProgramCard({
  providerName,
  providerCode,
  balance,
  balanceUnit,
  eliteStatus,
  expirationDate,
  logoUrl,
  compact = false,
  className,
}: LoyaltyProgramCardProps) {
  const expiring = isExpiringSoon(expirationDate);
  const formattedExpiration = formatExpirationDate(expirationDate);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 px-2 py-1', className)}>
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={providerName}
            width={20}
            height={20}
            className="rounded"
            unoptimized
          />
        ) : (
          <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
            {providerCode.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="text-xs font-medium truncate">{providerName}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {formatBalance(balance)} {balanceUnit}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors',
        className,
      )}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={providerName}
          width={40}
          height={40}
          className="rounded-lg shrink-0"
          unoptimized
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
          {providerCode.slice(0, 2).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate">{providerName}</h4>
          {eliteStatus && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0">
              {eliteStatus}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-lg font-semibold">
            {formatBalance(balance)}{' '}
            <span className="text-sm font-normal text-muted-foreground">{balanceUnit}</span>
          </p>
        </div>
        {formattedExpiration && (
          <div
            className={cn(
              'flex items-center gap-1 mt-1 text-[11px]',
              expiring ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground',
            )}
          >
            {expiring && <AlertTriangleIcon className="w-3 h-3" />}
            <span>Läuft ab: {formattedExpiration}</span>
          </div>
        )}
      </div>
    </div>
  );
}
