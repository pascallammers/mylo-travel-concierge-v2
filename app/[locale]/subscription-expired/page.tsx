'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CreditCard, LogOut, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function SubscriptionExpiredPage() {
  const router = useRouter();
  const t = useTranslations('subscriptionExpired');
  const ta = useTranslations('auth');
  const tc = useTranslations('common');

  const handleSignOut = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success(ta('signOutSuccess'));
            router.push('/sign-in');
          },
        },
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error(ta('signOutError'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('title')}</CardTitle>
          <CardDescription className="mt-2 text-base">
            {t('description')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <h3 className="font-semibold mb-2">{t('whatNow')}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{t('renewHint')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{t('supportHint')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{t('dataHint')}</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/pricing">
              <Button className="w-full" size="lg">
                <CreditCard className="mr-2 h-5 w-5" />
                {t('renewButton')}
              </Button>
            </Link>

            <a href="mailto:support@never-economy-again.com">
              <Button variant="outline" className="w-full" size="lg">
                <Mail className="mr-2 h-5 w-5" />
                {t('contactSupport')}
              </Button>
            </a>
          </div>
        </CardContent>

        <CardFooter className="flex justify-center border-t pt-6">
          <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            {tc('signOut')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
