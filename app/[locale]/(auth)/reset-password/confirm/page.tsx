'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect, Suspense } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { MyloLogo } from '@/components/logos/mylo-logo';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('resetPasswordConfirm');
  const tc = useTranslations('common');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      toast.error(t('invalidLink'));
      router.push('/reset-password');
    } else {
      setToken(tokenParam);
    }
  }, [searchParams, router, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error(t('noToken'));
      return;
    }

    if (password.length < 8) {
      toast.error(t('minLength'));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t('mismatch'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || t('resetError'));
      }

      toast.success(t('resetSuccess'));
      router.push('/sign-in');
    } catch (error: any) {
      console.error('Password reset confirm error:', error);
      const errorMessage = error?.message || t('resetErrorExpired');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
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
              <Label htmlFor="password">{t('newPassword')}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? tc('loading') : t('resetButton')}
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

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
