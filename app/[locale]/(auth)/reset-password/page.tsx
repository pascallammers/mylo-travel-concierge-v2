'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from 'sonner';
import { MyloLogo } from '@/components/logos/mylo-logo';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const t = useTranslations('resetPassword');
  const tc = useTranslations('common');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forget-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || t('sendError'));
      }

      setSent(true);
      toast.success(t('emailSentSuccess'));
    } catch (error: any) {
      console.error('Password reset error:', error);
      const errorMessage = error?.message || t('sendErrorRetry');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto space-y-12">
          <div className="flex items-center justify-center gap-3">
            <MyloLogo className="size-8" />
            <h2 className="text-2xl font-normal font-be-vietnam-pro">MYLO</h2>
          </div>

          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-medium">{t('emailSentTitle')}</h1>
            <p className="text-muted-foreground">{t('emailSentMessage')}</p>
            <Link href="/sign-in">
              <Button variant="outline" className="w-full">
                {t('backToLogin')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto space-y-12">
        <div className="flex items-center justify-center gap-3">
          <MyloLogo className="size-8" />
          <h2 className="text-2xl font-normal font-be-vietnam-pro">MYLO</h2>
        </div>

        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-medium">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{tc('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('backToLogin') === 'Zurück zum Login' ? 'deine@email.de' : 'your@email.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? tc('loading') : t('sendResetLink')}
            </Button>
          </form>

          <div className="text-center">
            <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
