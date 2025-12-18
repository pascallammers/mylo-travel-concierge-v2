'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, UserPlus, AlertTriangle, CheckCircle } from 'lucide-react';

interface UserCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal for creating new users with subscription.
 * Creates user + account (with password) + subscription and sends welcome email.
 */
export function UserCreateModal({ open, onClose, onSuccess }: UserCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<Date | undefined>(() => {
    // Default to 30 days from now
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  });

  const resetForm = () => {
    setName('');
    setEmail('');
    const date = new Date();
    date.setDate(date.getDate() + 30);
    setSubscriptionEndDate(date);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Name erforderlich');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Gültige E-Mail erforderlich');
      return;
    }
    if (!subscriptionEndDate) {
      toast.error('Subscription End-Date erforderlich');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          subscriptionEndDate: subscriptionEndDate.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'User konnte nicht erstellt werden');
      }

      if (data.emailSent) {
        toast.success('User erstellt', {
          description: `${name} wurde angelegt und hat eine Welcome-E-Mail erhalten.`,
          icon: <CheckCircle className="h-4 w-4 text-green-500" />,
        });
      } else {
        toast.warning('User erstellt - E-Mail fehlgeschlagen', {
          description: `Temporäres Passwort: ${data.temporaryPassword}`,
          duration: 10000,
        });
      }

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Fehler', {
        description: error instanceof Error ? error.message : 'User konnte nicht erstellt werden',
      });
    } finally {
      setLoading(false);
    }
  };

  const isPastDate = subscriptionEndDate && subscriptionEndDate < new Date();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Neuen User erstellen
          </DialogTitle>
          <DialogDescription>
            Der User erhält automatisch eine Welcome-E-Mail mit Zugangsdaten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Max Mustermann"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail *</Label>
            <Input
              id="email"
              type="email"
              placeholder="max@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Subscription gültig bis *</Label>
            <DatePicker
              date={subscriptionEndDate}
              onDateChange={setSubscriptionEndDate}
              placeholder="Datum wählen"
              disabled={loading}
            />
          </div>

          {isPastDate && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Das Datum liegt in der Vergangenheit!
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertDescription className="text-sm">
              <strong>Was passiert:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>User-Account wird erstellt</li>
                <li>Temporäres Passwort wird generiert</li>
                <li>Subscription wird angelegt</li>
                <li>Welcome-E-Mail wird gesendet</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={loading || isPastDate}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Erstelle...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                User erstellen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
