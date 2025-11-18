'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { forgetPassword } from '@/lib/auth-client';
import { toast } from 'sonner';
import Link from 'next/link';
import { MyloLogo } from '@/components/logos/mylo-logo';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await forgetPassword({
        email,
        redirectTo: '/reset-password/confirm',
      });
      setSent(true);
      toast.success('Passwort-Reset E-Mail wurde gesendet!');
    } catch (error: any) {
      console.error('Password reset error:', error);

      // Detailed error message for user
      const errorMessage = error?.message || 'Fehler beim Senden der E-Mail. Bitte versuche es später erneut.';
      toast.error(errorMessage);

      // User-specific error handling
      if (errorMessage.toLowerCase().includes('not found')) {
        toast.error('Diese E-Mail-Adresse ist nicht registriert.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto space-y-12">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3">
            <MyloLogo className="size-8" />
            <h2 className="text-2xl font-normal font-be-vietnam-pro">MYLO</h2>
          </div>

          {/* Success Message */}
          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-medium">E-Mail gesendet</h1>
            <p className="text-muted-foreground">Prüfe dein Postfach für weitere Anweisungen.</p>
            <Link href="/sign-in">
              <Button variant="outline" className="w-full">
                Zurück zum Login
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
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <MyloLogo className="size-8" />
          <h2 className="text-2xl font-normal font-be-vietnam-pro">MYLO</h2>
        </div>

        {/* Reset Form */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-medium">Passwort zurücksetzen</h1>
            <p className="text-sm text-muted-foreground">Gib deine E-Mail-Adresse ein</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="deine@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Lädt...' : 'Reset-Link senden'}
            </Button>
          </form>

          <div className="text-center">
            <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
              Zurück zum Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
