'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { signIn } from '@/lib/auth-client';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

/**
 * Login-only authentication component
 * No sign-up form - users are created via webhook after purchase
 */
export default function AuthCard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn.email(
        {
          email,
          password,
          callbackURL: '/',
        },
        {
          onSuccess: () => {
            toast.success('Erfolgreich eingeloggt!');
            // Use window.location for full page reload to ensure session cookie is recognized
            window.location.href = '/';
          },
          onError: (ctx) => {
            toast.error(ctx.error.message || 'Login fehlgeschlagen. Bitte prüfe deine Zugangsdaten.');
            setLoading(false);
          },
        },
      );
    } catch (error: any) {
      toast.error(error?.message || 'Login fehlgeschlagen. Bitte prüfe deine Zugangsdaten.');
      console.error('Auth error:', error);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-12">
      {/* Logo */}
      <div className="flex items-center justify-center">
        <Image
          src="/mylo-logo.png"
          alt="MYLO Logo"
          width={180}
          height={48}
          priority
        />
      </div>

      {/* Login Form */}
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-medium">Willkommen zurück</h1>
          <p className="text-sm text-muted-foreground">Melde dich mit deinen Zugangsdaten an</p>
        </div>

        {/* Login Form */}
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
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Passwort</Label>
              <Link href="/reset-password" className="text-xs text-muted-foreground hover:text-foreground">
                Vergessen?
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
            {loading ? 'Lädt...' : 'Anmelden'}
          </Button>
        </form>

        {/* Footer */}
        <div className="pt-4">
          <p className="text-xs text-center text-muted-foreground">
            Noch kein Zugang?{' '}
            <Link href="https://chat.never-economy-again.com" className="text-foreground hover:underline" target="_blank">
              MYLO jetzt kaufen
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
