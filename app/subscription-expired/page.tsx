'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CreditCard, LogOut, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';

export default function SubscriptionExpiredPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success('Erfolgreich abgemeldet');
            router.push('/sign-in');
          },
        },
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Fehler beim Abmelden');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Dein Zugriff ist abgelaufen</CardTitle>
          <CardDescription className="mt-2 text-base">
            Deine Subscription ist nicht mehr aktiv. Um MYLO weiterhin nutzen zu können, musst du dein Abo verlängern.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <h3 className="font-semibold mb-2">Was jetzt?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Verlängere dein Abo über unsere Pricing-Seite</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Bei Fragen wende dich an unseren Support</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Deine Daten und Chats bleiben gespeichert</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/pricing">
              <Button className="w-full" size="lg">
                <CreditCard className="mr-2 h-5 w-5" />
                Subscription verlängern
              </Button>
            </Link>

            <a href="mailto:support@scira.ai">
              <Button variant="outline" className="w-full" size="lg">
                <Mail className="mr-2 h-5 w-5" />
                Support kontaktieren
              </Button>
            </a>
          </div>
        </CardContent>

        <CardFooter className="flex justify-center border-t pt-6">
          <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
