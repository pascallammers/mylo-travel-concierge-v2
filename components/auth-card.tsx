'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { signIn } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Login-only authentication component
 * No sign-up form - users are created via webhook after purchase
 */
export default function AuthCard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations('auth');
  const tc = useTranslations('common');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn.email(
        {
          email: email.toLowerCase().trim(),
          password,
          callbackURL: '/',
        },
        {
          onSuccess: () => {
            toast.success(t('loginSuccess'));
            router.replace('/');
            router.refresh();
          },
          onError: (ctx) => {
            toast.error(ctx.error.message || t('loginError'));
            setLoading(false);
          },
        },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('loginError');
      toast.error(message);
      console.error('Auth error:', error);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-12">
      <div className="flex items-center justify-center">
        <Image
          src="/mylo-logo.png"
          alt="MYLO Logo"
          width={180}
          height={48}
          priority
        />
      </div>

      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-medium">{t('welcomeBack')}</h1>
          <p className="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('emailLabel')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('passwordLabel')}</Label>
              <Link href="/reset-password" className="text-xs text-muted-foreground hover:text-foreground">
                {t('forgot')}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? tc('loading') : t('loginButton')}
          </Button>
        </form>

        <div className="pt-4">
          <p className="text-xs text-center text-muted-foreground">
            {t('noAccount')}{' '}
            <a href="https://chat.never-economy-again.com" className="text-foreground hover:underline" target="_blank">
              {t('buyNow')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
