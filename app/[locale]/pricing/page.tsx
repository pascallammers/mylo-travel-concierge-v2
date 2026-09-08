export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { CreditCard, Mail, MessageSquare } from 'lucide-react';
import { getCurrentUser } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

const THRIVECART_BILLING_URL = 'https://never-economy-again.thrivecart.com/updateinfo/';
const SUPPORT_EMAIL = 'support@never-economy-again.com';

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, user] = await Promise.all([getTranslations({ locale, namespace: 'pricing' }), getCurrentUser()]);

  const subscription = user?.subscription;
  const isActive = user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'canceled';
  const periodEnd = subscription
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(subscription.currentPeriodEnd))
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">{isActive ? t('activeTitle') : t('inactiveTitle')}</CardTitle>
          <CardDescription className="text-base">
            {isActive ? t('activeDescription') : t('inactiveDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {periodEnd && (
            <p className="text-sm text-muted-foreground">
              {subscription?.cancelAtPeriodEnd ? t('endsAt', { date: periodEnd }) : t('renewsAt', { date: periodEnd })}
            </p>
          )}
          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="w-full">
              <a href={THRIVECART_BILLING_URL} target="_blank" rel="noopener noreferrer">
                <CreditCard className="mr-2 h-5 w-5" />
                {t('manageBilling')}
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full">
              <a href={`mailto:${SUPPORT_EMAIL}`}>
                <Mail className="mr-2 h-5 w-5" />
                {t('contactSupport')}
              </a>
            </Button>
            {isActive && (
              <Button asChild variant="ghost" size="lg" className="w-full">
                <Link href="/">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  {t('backToChat')}
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
