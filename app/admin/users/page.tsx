'use client';

import { useState } from 'react';
import { UserTable } from '@/components/admin/user-table';
import { UserEditModal } from '@/components/admin/user-edit-modal';
import { useAdminUsers, type AdminUser } from '@/hooks/use-admin-users';
import { toast } from 'sonner';

/**
 * Admin Users Page
 * 
 * Displays a paginated, searchable list of users with management capabilities.
 * 
 * Features:
 * - Live search with 300ms debouncing (no search button needed)
 * - Optimized data loading with TanStack Query caching
 * - Role management
 * - Password reset
 * - User deactivation
 */
export default function UsersPage() {
  // Use the optimized admin users hook
  const {
    data,
    users,
    total,
    isLoading,
    isFetching,
    isError,
    error,
    search,
    setSearch,
    page,
    setPage,
    limit,
    refetch,
  } = useAdminUsers();

  // Modal state
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  /**
   * Updates a user's role
   */
  const handleRoleUpdate = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        throw new Error('Failed to update user role');
      }

      toast.success('Rolle aktualisiert', {
        description: `Benutzerrolle wurde auf ${newRole} geändert`,
      });

      // Refresh data
      refetch();
    } catch (err) {
      console.error('Error updating role:', err);
      toast.error('Fehler', {
        description: err instanceof Error ? err.message : 'Rolle konnte nicht aktualisiert werden',
      });
      throw err;
    }
  };

  /**
   * Sends a password reset email to the user
   */
  const handlePasswordReset = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Failed to send password reset email');
      }

      toast.success('E-Mail gesendet', {
        description: 'Password Reset E-Mail wurde erfolgreich versendet',
      });
    } catch (err) {
      console.error('Error sending password reset:', err);
      toast.error('Fehler', {
        description: err instanceof Error ? err.message : 'E-Mail konnte nicht gesendet werden',
      });
      throw err;
    }
  };

  /**
   * Opens the edit modal for a user
   */
  const handleEditUser = (user: AdminUser) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  };

  /**
   * Deactivates a user account
   */
  const handleDeactivateUser = async (userId: string) => {
    const userToDeactivate = users.find((u) => u.id === userId);
    if (!userToDeactivate) return;

    if (!confirm(`Möchtest du den Account von ${userToDeactivate.name} wirklich deaktivieren?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to deactivate user');
      }

      toast.success('Benutzer deaktiviert', {
        description: `${userToDeactivate.name} kann sich nicht mehr einloggen`,
      });

      // Refresh data
      refetch();
    } catch (err) {
      console.error('Error deactivating user:', err);
      toast.error('Fehler', {
        description: err instanceof Error ? err.message : 'Benutzer konnte nicht deaktiviert werden',
      });
      throw err;
    }
  };

  /**
   * Closes the edit modal
   */
  const handleModalClose = () => {
    setEditModalOpen(false);
    setSelectedUser(null);
  };

  /**
   * Callback when modal action succeeds
   */
  const handleModalSuccess = () => {
    refetch();
  };

  // Error state
  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Error Loading Users</h2>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          Manage user roles and view activity statistics
        </p>
      </div>

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-muted-foreground">Benutzer werden geladen...</div>
        </div>
      ) : (
        <>
          <UserTable
            users={users}
            total={total}
            page={page}
            limit={limit}
            search={search}
            isFetching={isFetching}
            onPageChange={setPage}
            onSearchChange={setSearch}
            onRoleUpdate={handleRoleUpdate}
            onPasswordReset={handlePasswordReset}
            onEditUser={handleEditUser}
            onDeactivateUser={handleDeactivateUser}
          />
          
          <UserEditModal
            user={selectedUser}
            open={editModalOpen}
            onClose={handleModalClose}
            onSuccess={handleModalSuccess}
            onPasswordReset={handlePasswordReset}
          />
        </>
      )}
    </div>
  );
}
