'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect, Suspense } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MyloLogo } from '@/components/logos/mylo-logo';
import { resetPassword } from '@/lib/auth-client';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      toast.error('Ungültiger Reset-Link');
      router.push('/reset-password');
    } else {
      setToken(tokenParam);
    }
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('Kein gültiger Token gefunden');
      return;
    }

    if (password.length < 8) {
      toast.error('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }

    setLoading(true);

    try {
      // Use Better-Auth's resetPassword with our custom token
      await resetPassword({
        newPassword: password,
        token,
      });

      toast.success('Passwort erfolgreich zurückgesetzt!');
      router.push('/sign-in');
    } catch (error: any) {
      console.error('Password reset confirm error:', error);
      const errorMessage =
        error?.message || 'Fehler beim Zurücksetzen des Passworts. Der Link könnte abgelaufen sein.';
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
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <MyloLogo className="size-8" />
          <h2 className="text-2xl font-normal font-be-vietnam-pro">MYLO</h2>
        </div>

        {/* Reset Password Form */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-medium">Neues Passwort setzen</h1>
            <p className="text-sm text-muted-foreground">Wähle ein sicheres neues Passwort</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Neues Passwort</Label>
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
              <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
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
              {loading ? 'Lädt...' : 'Passwort zurücksetzen'}
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
