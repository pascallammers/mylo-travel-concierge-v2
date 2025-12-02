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
import { Search, ChevronLeft, ChevronRight, Mail, Loader2, Pencil, Ban } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminUser } from '@/hooks/use-admin-users';

interface UserTableProps {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  /** Current search value for controlled input */
  search: string;
  /** Whether a background fetch is in progress */
  isFetching?: boolean;
  onPageChange: (page: number) => void;
  /** Live search handler - called on every keystroke */
  onSearchChange: (search: string) => void;
  onRoleUpdate: (userId: string, newRole: 'user' | 'admin') => Promise<void>;
  onPasswordReset?: (userId: string) => Promise<void>;
  onEditUser?: (user: AdminUser) => void;
  onDeactivateUser?: (userId: string) => Promise<void>;
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
  onPageChange,
  onSearchChange,
  onRoleUpdate,
  onPasswordReset,
  onEditUser,
  onDeactivateUser,
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
      {/* Live Search */}
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
      </div>

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
