'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { signIn } from '@/lib/auth-client';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
      await signIn.email({
        email,
        password,
        callbackURL: '/',
      });
      toast.success('Erfolgreich eingeloggt!');
      router.push('/');
    } catch (error) {
      toast.error('Login fehlgeschlagen. Bitte prüfe deine Zugangsdaten.');
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[380px] mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
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
            <Link href="https://scira.ai" className="text-foreground hover:underline" target="_blank">
              MYLO jetzt kaufen
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
