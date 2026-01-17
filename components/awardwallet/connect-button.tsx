'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Wallet02Icon } from '@hugeicons/core-free-icons';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ConnectState = 'idle' | 'loading' | 'redirecting';

interface LoyaltyConnectButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showIcon?: boolean;
  children?: React.ReactNode;
}

/**
 * Button component to initiate AwardWallet OAuth connection
 * @param variant - Button variant (default, outline, ghost)
 * @param size - Button size (sm, default, lg)
 * @param className - Additional CSS classes
 * @param showIcon - Whether to show the wallet icon
 * @param children - Custom button text (default: "Mit AwardWallet verbinden")
 */
export function LoyaltyConnectButton({
  variant = 'default',
  size = 'default',
  className,
  showIcon = true,
  children,
}: LoyaltyConnectButtonProps) {
  const [state, setState] = useState<ConnectState>('idle');

  const handleConnect = async () => {
    setState('loading');

    try {
      const response = await fetch('/api/awardwallet/auth/initiate', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Verbindung fehlgeschlagen');
        setState('idle');
        return;
      }

      if (data.authUrl) {
        setState('redirecting');
        window.location.href = data.authUrl;
      } else {
        toast.error('Keine Autorisierungs-URL erhalten');
        setState('idle');
      }
    } catch (error) {
      console.error('[AwardWallet] Connect error:', error);
      toast.error('Verbindung fehlgeschlagen. Bitte versuche es erneut.');
      setState('idle');
    }
  };

  const isDisabled = state !== 'idle';

  const buttonText = () => {
    if (children) return children;

    switch (state) {
      case 'loading':
        return 'Verbinde...';
      case 'redirecting':
        return 'Weiterleitung...';
      default:
        return 'Mit AwardWallet verbinden';
    }
  };

  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleConnect}
      disabled={isDisabled}
      className={cn(className)}
    >
      {state === 'loading' || state === 'redirecting' ? (
        <Loader2 className={cn('animate-spin', size === 'sm' ? 'h-3 w-3 mr-1.5' : 'h-4 w-4 mr-2')} />
      ) : showIcon ? (
        <HugeiconsIcon
          icon={Wallet02Icon}
          size={iconSize}
          className={size === 'sm' ? 'mr-1.5' : 'mr-2'}
        />
      ) : null}
      {buttonText()}
    </Button>
  );
}

/**
 * Hint text for users without an AwardWallet account
 */
export function AwardWalletSignupHint({ className }: { className?: string }) {
  return (
    <p className={cn('text-[10px] text-muted-foreground', className)}>
      Noch kein AwardWallet?{' '}
      <a
        href="https://awardwallet.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        Kostenlos registrieren
      </a>
    </p>
  );
}
