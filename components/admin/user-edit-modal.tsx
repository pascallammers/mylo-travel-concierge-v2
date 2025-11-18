'use client';

import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Mail, Ban, AlertTriangle, Loader2 } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean | null;
  activationStatus: 'active' | 'inactive' | 'grace_period' | 'suspended' | null;
  subscriptionStatus?: 'active' | 'inactive' | 'cancelled' | 'none';
  subscriptionValidUntil?: string | null;
}

interface UserEditModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onPasswordReset?: (userId: string) => Promise<void>;
}

export function UserEditModal({
  user,
  open,
  onClose,
  onSuccess,
  onPasswordReset,
}: UserEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [isActive, setIsActive] = useState(true);
  const [activationStatus, setActivationStatus] = useState<'active' | 'inactive' | 'grace_period' | 'suspended'>('active');
  const [subscriptionValidUntil, setSubscriptionValidUntil] = useState<Date | undefined>();
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'canceled'>('active');

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setIsActive(user.isActive ?? true);
      setActivationStatus(user.activationStatus || 'active');
      
      if (user.subscriptionValidUntil) {
        setSubscriptionValidUntil(new Date(user.subscriptionValidUntil));
      } else {
        setSubscriptionValidUntil(undefined);
      }
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Update user data
      const userResponse = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          role,
          isActive,
          activationStatus,
        }),
      });

      if (!userResponse.ok) {
        throw new Error('Failed to update user');
      }

      // Update subscription if changed
      if (subscriptionValidUntil) {
        const subscriptionResponse = await fetch(`/api/admin/users/${user.id}/subscription`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            validUntil: subscriptionValidUntil.toISOString(),
            status: subscriptionStatus,
          }),
        });

        if (!subscriptionResponse.ok) {
          const error = await subscriptionResponse.json();
          console.warn('Subscription update warning:', error);
        }
      }

      toast.success('Benutzer aktualisiert', {
        description: 'Die Änderungen wurden erfolgreich gespeichert',
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Fehler', {
        description: error instanceof Error ? error.message : 'Benutzer konnte nicht aktualisiert werden',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!user) return;
    if (!confirm(`Möchtest du den Account von ${user.name} wirklich deaktivieren?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate user');
      }

      toast.success('Benutzer deaktiviert', {
        description: `${user.name} kann sich nicht mehr einloggen`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast.error('Fehler', {
        description: 'Benutzer konnte nicht deaktiviert werden',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !onPasswordReset) return;
    
    setLoading(true);
    try {
      await onPasswordReset(user.id);
      toast.success('E-Mail gesendet', {
        description: 'Password Reset E-Mail wurde versendet',
      });
    } catch (error) {
      console.error('Error sending password reset:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const isPastDate = subscriptionValidUntil && subscriptionValidUntil < new Date();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Benutzer bearbeiten</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="actions">Aktionen</TabsTrigger>
          </TabsList>

          {/* Tab 1: Profile */}
          <TabsContent value="profile" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rolle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'user' | 'admin')} disabled={loading}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="is-active" className="flex flex-col space-y-1">
                <span>Account aktiv</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Deaktivierte Accounts können sich nicht einloggen
                </span>
              </Label>
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activation-status">Activation Status</Label>
              <Select
                value={activationStatus}
                onValueChange={(v) => setActivationStatus(v as typeof activationStatus)}
                disabled={loading}
              >
                <SelectTrigger id="activation-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="grace_period">Grace Period</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Tab 2: Subscription */}
          <TabsContent value="subscription" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="subscription-status">Subscription Status</Label>
              <Select
                value={subscriptionStatus}
                onValueChange={(v) => setSubscriptionStatus(v as 'active' | 'canceled')}
                disabled={loading}
              >
                <SelectTrigger id="subscription-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="canceled">Gekündigt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Gültig bis</Label>
              <DatePicker
                date={subscriptionValidUntil}
                onDateChange={setSubscriptionValidUntil}
                placeholder="Datum wählen"
                disabled={loading}
              />
            </div>

            {isPastDate && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  ⚠️ Das gewählte Datum liegt in der Vergangenheit. Der Benutzer kann sich
                  nach dem Speichern nicht mehr einloggen!
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertDescription className="text-sm">
                <strong>Hinweis:</strong> Wenn "Gültig bis" in der Vergangenheit liegt,
                wird der Zugriff des Benutzers beim nächsten Login-Versuch blockiert.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Tab 3: Actions */}
          <TabsContent value="actions" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Button
                onClick={handlePasswordReset}
                variant="outline"
                className="w-full justify-start"
                disabled={loading || !onPasswordReset}
              >
                <Mail className="mr-2 h-4 w-4" />
                Password Reset E-Mail senden
              </Button>

              <Button
                onClick={handleDeactivate}
                variant="destructive"
                className="w-full justify-start"
                disabled={loading}
              >
                <Ban className="mr-2 h-4 w-4" />
                Account deaktivieren
              </Button>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                <strong>Vorsicht:</strong> Das Deaktivieren eines Accounts ist ein permanenter
                Vorgang. Der Benutzer kann sich danach nicht mehr einloggen.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Speichern...
              </>
            ) : (
              'Änderungen speichern'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
