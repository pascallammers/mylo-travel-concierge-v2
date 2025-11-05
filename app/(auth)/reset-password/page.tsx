'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { resetPassword } from '@/lib/auth-client';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await resetPassword({ email });
      setSent(true);
      toast.success('Passwort-Reset E-Mail wurde gesendet!');
    } catch (error) {
      toast.error('Fehler beim Senden der E-Mail.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-[380px] text-center space-y-4">
          <h1 className="text-2xl font-medium">E-Mail gesendet</h1>
          <p className="text-muted-foreground">Prüfe dein Postfach für weitere Anweisungen.</p>
          <Link href="/sign-in">
            <Button variant="outline" className="w-full">
              Zurück zum Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[380px]">
        <div className="space-y-6">
          <div className="text-center space-y-3">
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
