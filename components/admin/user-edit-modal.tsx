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
import { Mail, Ban, AlertTriangle, Loader2, History, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ResendDeliveryStatus = 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked' | 'pending';

interface PasswordResetHistoryEntry {
  id: string;
  sentAt: string;
  triggerType: 'manual' | 'bulk';
  status: 'sent' | 'failed';
  errorMessage: string | null;
  sentByName: string | null;
  resendEmailId: string | null;
  resendStatus: ResendDeliveryStatus | null;
  resendVerifiedAt: string | null;
}

/**
 * Returns badge variant and label for Resend delivery status
 */
function getResendStatusBadge(status: ResendDeliveryStatus | null, hasEmailId: boolean) {
  if (!hasEmailId) {
    return { variant: 'outline' as const, label: 'Keine ID', color: 'text-muted-foreground' };
  }
  
  switch (status) {
    case 'delivered':
      return { variant: 'green' as const, label: 'Zugestellt', color: 'text-green-600' };
    case 'opened':
      return { variant: 'green' as const, label: 'Geöffnet', color: 'text-green-600' };
    case 'clicked':
      return { variant: 'green' as const, label: 'Geklickt', color: 'text-green-600' };
    case 'bounced':
      return { variant: 'destructive' as const, label: 'Bounced', color: 'text-destructive' };
    case 'complained':
      return { variant: 'destructive' as const, label: 'Spam', color: 'text-destructive' };
    case 'pending':
      return { variant: 'secondary' as const, label: 'Ausstehend', color: 'text-yellow-600' };
    default:
      return { variant: 'outline' as const, label: 'Nicht geprüft', color: 'text-muted-foreground' };
  }
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isActive?: boolean | null;
  activationStatus?: 'active' | 'inactive' | 'grace_period' | 'suspended' | 'cancelled' | null;
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
  const [passwordResetHistory, setPasswordResetHistory] = useState<PasswordResetHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [verifyingEntries, setVerifyingEntries] = useState<Set<string>>(new Set());
  const [batchVerifying, setBatchVerifying] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [isActive, setIsActive] = useState(true);
  const [activationStatus, setActivationStatus] = useState<'active' | 'inactive' | 'grace_period' | 'suspended' | 'cancelled'>('active');
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

  // Load password reset history when modal opens
  useEffect(() => {
    if (open && user) {
      setHistoryLoading(true);
      fetch(`/api/admin/users/${user.id}/password-reset-history`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setPasswordResetHistory(data.history);
          }
        })
        .catch((err) => {
          console.error('Error loading password reset history:', err);
        })
        .finally(() => {
          setHistoryLoading(false);
        });
    } else if (!open) {
      setPasswordResetHistory([]);
    }
  }, [open, user]);

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
      // Reload history to show new entry
      fetch(`/api/admin/users/${user.id}/password-reset-history`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setPasswordResetHistory(data.history);
          }
        });
    } catch (error) {
      console.error('Error sending password reset:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verify a single email status with Resend
   */
  const handleVerifyEntry = async (historyId: string) => {
    if (!user) return;
    
    setVerifyingEntries((prev) => new Set(prev).add(historyId));
    try {
      const response = await fetch(`/api/admin/users/${user.id}/password-reset-history/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId }),
      });
      
      const result = await response.json();
      
      if (result.success && result.status) {
        // Update the entry in state
        setPasswordResetHistory((prev) =>
          prev.map((entry) =>
            entry.id === historyId
              ? { ...entry, resendStatus: result.status, resendVerifiedAt: result.verifiedAt }
              : entry
          )
        );
        
        const statusLabel = getResendStatusBadge(result.status, true).label;
        toast.success('Status verifiziert', {
          description: `E-Mail Status: ${statusLabel}`,
        });
      } else {
        toast.error('Verifizierung fehlgeschlagen', {
          description: result.message || 'Status konnte nicht abgerufen werden',
        });
      }
    } catch (error) {
      console.error('Error verifying entry:', error);
      toast.error('Fehler', {
        description: 'Status konnte nicht verifiziert werden',
      });
    } finally {
      setVerifyingEntries((prev) => {
        const next = new Set(prev);
        next.delete(historyId);
        return next;
      });
    }
  };

  /**
   * Batch verify all unverified emails
   */
  const handleBatchVerify = async () => {
    if (!user) return;
    
    setBatchVerifying(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/password-reset-history/verify`);
      const result = await response.json();
      
      if (result.success) {
        // Reload history to get updated statuses
        const historyResponse = await fetch(`/api/admin/users/${user.id}/password-reset-history`);
        const historyData = await historyResponse.json();
        if (historyData.success) {
          setPasswordResetHistory(historyData.history);
        }
        
        toast.success('Batch-Verifizierung abgeschlossen', {
          description: `${result.verified} von ${result.total} E-Mails verifiziert`,
        });
      } else {
        toast.error('Verifizierung fehlgeschlagen', {
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Error batch verifying:', error);
      toast.error('Fehler', {
        description: 'Batch-Verifizierung fehlgeschlagen',
      });
    } finally {
      setBatchVerifying(false);
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

            {/* Account Status Section */}
            <div className="pt-4 border-t space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Account-Status</h4>
              
              <div className="space-y-2">
                <Label htmlFor="activation-status">Status</Label>
                <Select
                  value={activationStatus}
                  onValueChange={(v) => setActivationStatus(v as typeof activationStatus)}
                  disabled={loading}
                >
                  <SelectTrigger id="activation-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                    <SelectItem value="grace_period">Gnadenfrist</SelectItem>
                    <SelectItem value="suspended">Gesperrt</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Bestimmt den Zugriffsstatus des Benutzers im System
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="is-active" className="flex flex-col space-y-1">
                  <span>Login erlaubt</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Wenn deaktiviert, kann sich der Benutzer nicht einloggen
                  </span>
                </Label>
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={loading}
                />
              </div>
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
                <strong>Hinweis:</strong> Wenn &quot;Gültig bis&quot; in der Vergangenheit liegt,
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

            {/* Password Reset History */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium text-sm">Password Reset Historie</h4>
                </div>
                {passwordResetHistory.some((e) => e.resendEmailId && !e.resendVerifiedAt) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBatchVerify}
                    disabled={batchVerifying}
                    className="h-7 text-xs"
                  >
                    {batchVerifying ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Alle prüfen
                  </Button>
                )}
              </div>

              {historyLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : passwordResetHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Noch keine Password-Reset-E-Mails gesendet.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {passwordResetHistory.map((entry) => {
                    const resendBadge = getResendStatusBadge(entry.resendStatus, !!entry.resendEmailId);
                    const isVerifying = verifyingEntries.has(entry.id);
                    
                    return (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-2 rounded-md bg-muted/50 text-sm"
                      >
                        {entry.status === 'sent' ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground">
                              {new Date(entry.sentAt).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <Badge variant={entry.triggerType === 'bulk' ? 'secondary' : 'outline'} className="text-xs">
                              {entry.triggerType === 'bulk' ? 'Bulk' : 'Manuell'}
                            </Badge>
                            {/* Resend Status Badge */}
                            <Badge variant={resendBadge.variant} className="text-xs">
                              {resendBadge.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {entry.sentByName && (
                              <p className="text-xs text-muted-foreground">
                                von {entry.sentByName}
                              </p>
                            )}
                            {entry.resendVerifiedAt && (
                              <p className="text-xs text-muted-foreground">
                                • geprüft {new Date(entry.resendVerifiedAt).toLocaleDateString('de-DE')}
                              </p>
                            )}
                          </div>
                          {entry.errorMessage && (
                            <p className="text-xs text-destructive mt-0.5">
                              {entry.errorMessage}
                            </p>
                          )}
                        </div>
                        {/* Verify Button */}
                        {entry.resendEmailId && entry.status === 'sent' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVerifyEntry(entry.id)}
                            disabled={isVerifying}
                            className="h-6 w-6 p-0 shrink-0"
                            title="Status bei Resend prüfen"
                          >
                            {isVerifying ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
