'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight, Mail, Loader2, Pencil, Ban, Send, X, Filter, UserPlus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { AdminUser, UserFilters, UserStatusFilter, UserRoleFilter, ExpiresInFilter } from '@/hooks/use-admin-users';

interface UserTableProps {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  /** Current search value for controlled input */
  search: string;
  /** Whether a background fetch is in progress */
  isFetching?: boolean;
  /** Number of users with active subscriptions */
  activeUserCount?: number;
  /** Whether bulk reset is in progress */
  isBulkResetInProgress?: boolean;
  /** Current filter values */
  filters?: UserFilters;
  /** Whether any filters are active */
  hasActiveFilters?: boolean;
  onPageChange: (page: number) => void;
  /** Live search handler - called on every keystroke */
  onSearchChange: (search: string) => void;
  /** Filter change handler */
  onFiltersChange?: (filters: Partial<UserFilters>) => void;
  /** Reset all filters */
  onResetFilters?: () => void;
  onRoleUpdate: (userId: string, newRole: 'user' | 'admin') => Promise<void>;
  onPasswordReset?: (userId: string) => Promise<void>;
  onEditUser?: (user: AdminUser) => void;
  onDeactivateUser?: (userId: string) => Promise<void>;
  /** Bulk password reset for all active users */
  onBulkPasswordReset?: () => Promise<void>;
  /** Create new user callback */
  onCreateUser?: () => void;
}

/**
 * User management table with pagination, live search, and role updates.
 * 
 * Features:
 * - Live search with debouncing (handled by parent hook)
 * - Loading indicator during background fetches
 * - Role updates via dropdown
 * - Quick actions: password reset, edit, deactivate
 */
export function UserTable({
  users,
  total,
  page,
  limit,
  search,
  isFetching = false,
  activeUserCount = 0,
  isBulkResetInProgress = false,
  filters = { status: 'all', role: 'all', expiresIn: 'all' },
  hasActiveFilters = false,
  onPageChange,
  onSearchChange,
  onFiltersChange,
  onResetFilters,
  onRoleUpdate,
  onPasswordReset,
  onEditUser,
  onDeactivateUser,
  onBulkPasswordReset,
  onCreateUser,
}: UserTableProps) {
  const [updatingRoles, setUpdatingRoles] = useState<Set<string>>(new Set());
  const [sendingReset, setSendingReset] = useState<Set<string>>(new Set());
  const [deactivatingUsers, setDeactivatingUsers] = useState<Set<string>>(new Set());

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    setUpdatingRoles((prev) => new Set(prev).add(userId));
    try {
      await onRoleUpdate(userId, newRole);
    } finally {
      setUpdatingRoles((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handlePasswordReset = async (userId: string) => {
    if (!onPasswordReset) return;
    
    setSendingReset((prev) => new Set(prev).add(userId));
    try {
      await onPasswordReset(userId);
    } finally {
      setSendingReset((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!onDeactivateUser) return;
    
    setDeactivatingUsers((prev) => new Set(prev).add(userId));
    try {
      await onDeactivateUser(userId);
    } finally {
      setDeactivatingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const getSubscriptionBadge = (status: AdminUser['subscriptionStatus']) => {
    switch (status) {
      case 'active':
        return <Badge variant="green">Aktiv</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Gekündigt</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inaktiv</Badge>;
      case 'none':
        return <Badge variant="outline">Keine</Badge>;
      default:
        return <Badge variant="outline">Unbekannt</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Live Search + Bulk Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Email oder Name..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 pr-8"
          />
          {/* Loading indicator during search/fetch */}
          {isFetching && (
            <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Create User Button */}
        {onCreateUser && (
          <Button
            variant="default"
            onClick={onCreateUser}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <UserPlus className="h-4 w-4" />
            <span>User erstellen</span>
          </Button>
        )}

        {/* Bulk Password Reset Button */}
        {onBulkPasswordReset && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isBulkResetInProgress || activeUserCount === 0}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                {isBulkResetInProgress ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Bulk Reset</span>
                {activeUserCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeUserCount}
                  </Badge>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bulk Password Reset</AlertDialogTitle>
                <AlertDialogDescription>
                  Du bist dabei, eine Password-Reset-E-Mail an <strong>{activeUserCount} aktive Benutzer</strong> zu senden.
                  <br /><br />
                  Nur Benutzer mit aktivem Zugriff (grünes Badge) erhalten die E-Mail.
                  <br /><br />
                  Möchtest du fortfahren?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={onBulkPasswordReset}>
                  {activeUserCount} E-Mails senden
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Filter Bar */}
      {onFiltersChange && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filter:</span>
          </div>
          
          {/* Status Filter */}
          <Select
            value={filters.status}
            onValueChange={(value: UserStatusFilter) => onFiltersChange({ status: value })}
          >
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="inactive">Inaktiv</SelectItem>
            </SelectContent>
          </Select>

          {/* Role Filter */}
          <Select
            value={filters.role}
            onValueChange={(value: UserRoleFilter) => onFiltersChange({ role: value })}
          >
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="Rolle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Rollen</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>

          {/* Expires In Filter */}
          <Select
            value={filters.expiresIn}
            onValueChange={(value: ExpiresInFilter) => onFiltersChange({ expiresIn: value })}
          >
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue placeholder="Läuft ab in..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Laufzeiten</SelectItem>
              <SelectItem value="7">Nächste 7 Tage</SelectItem>
              <SelectItem value="30">Nächste 30 Tage</SelectItem>
              <SelectItem value="60">Nächste 60 Tage</SelectItem>
              <SelectItem value="90">Nächste 90 Tage</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset Filters Button */}
          {hasActiveFilters && onResetFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-8 gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Filter zurücksetzen
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Benutzer</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Zugriff</TableHead>
              <TableHead>Registriert</TableHead>
              <TableHead>Letzter Login</TableHead>
              <TableHead>Gültig bis</TableHead>
              <TableHead className="text-right">Tokens (30T)</TableHead>
              <TableHead className="text-center">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Keine Benutzer gefunden
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) =>
                        handleRoleChange(user.id, value as 'user' | 'admin')
                      }
                      disabled={updatingRoles.has(user.id)}
                    >
                      <SelectTrigger className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{getSubscriptionBadge(user.subscriptionStatus)}</TableCell>
                  <TableCell>{formatDate(user.registeredAt)}</TableCell>
                  <TableCell>{formatDate(user.lastLogin)}</TableCell>
                  <TableCell>
                    {user.subscriptionStatus === 'active' && user.subscriptionValidUntil
                      ? formatDate(user.subscriptionValidUntil)
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.tokensUsed.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* Mail Icon - Direct Password Reset */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePasswordReset(user.id)}
                        disabled={!onPasswordReset || sendingReset.has(user.id)}
                        title="Password Reset senden"
                      >
                        {sendingReset.has(user.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Edit Icon - Opens Modal */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditUser?.(user)}
                        disabled={!onEditUser}
                        title="Benutzer bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {/* Ban Icon - Deactivate User */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeactivate(user.id)}
                        disabled={!onDeactivateUser || deactivatingUsers.has(user.id)}
                        title="Benutzer deaktivieren"
                      >
                        {deactivatingUsers.has(user.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Ban className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {total === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}{' '}
          users
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
