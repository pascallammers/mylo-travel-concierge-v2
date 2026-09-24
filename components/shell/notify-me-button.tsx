'use client';

import { useId, useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { registerAreaInterestAction } from '@/app/area-interest-actions';
import { Button } from '@/components/ui/button';
import type { PreviewAreaSlug } from '@/lib/shell/preview-areas';

/**
 * Record preview interest and show confirmation or a recoverable error.
 * @param props - Preview area and initial registration loaded on the server.
 * @returns An accessible notification button with pending and feedback states.
 */
export function NotifyMeButton({ area, registered }: { area: PreviewAreaSlug; registered: boolean }) {
  const t = useTranslations('shell.preview');
  const [confirmed, setConfirmed] = useState(registered);
  const [feedback, setFeedback] = useState<'signInRequired' | 'error' | null>(null);
  const [isPending, startTransition] = useTransition();
  const feedbackId = useId();

  function register() {
    if (confirmed || isPending) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await registerAreaInterestAction(area);
        if (result.ok) {
          setConfirmed(true);
        } else {
          setFeedback(result.reason === 'unauthenticated' ? 'signInRequired' : 'error');
        }
      } catch {
        setFeedback('error');
      }
    });
  }

  return (
    <div className="space-y-3">
      <div role="status" aria-live="polite">
        <Button
          type="button"
          variant={confirmed ? 'secondary' : 'default'}
          className="w-full aria-disabled:cursor-default aria-disabled:opacity-50 sm:w-auto"
          aria-disabled={confirmed || isPending}
          aria-busy={isPending}
          aria-describedby={feedback ? feedbackId : undefined}
          onClick={register}
        >
          {confirmed ? <Check aria-hidden="true" /> : isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {t(confirmed ? 'notified' : 'notifyMe')}
        </Button>
      </div>
      {feedback && (
        <p id={feedbackId} role="alert" className={feedback === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
          {t(feedback)}
        </p>
      )}
    </div>
  );
}
