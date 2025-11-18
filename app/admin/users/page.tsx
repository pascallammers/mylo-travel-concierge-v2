'use client';

import { useEffect, useState } from 'react';
import { UserTable } from '@/components/admin/user-table';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  registeredAt: string;
  lastLogin: string | null;
  activeDays: number;
  sessions: number;
  tokensUsed: number;
  subscriptionStatus: 'active' | 'inactive' | 'cancelled' | 'none';
  subscriptionPlan: string | null;
  subscriptionValidUntil: string | null;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

export default function UsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const fetchUsers = async (currentPage: number, searchQuery: string) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
      });

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }

      const usersData = await res.json();
      setData(usersData);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page, search);
  }, [page, search]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleSearch = (searchQuery: string) => {
    setSearch(searchQuery);
    setPage(1); // Reset to first page on new search
  };

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
      fetchUsers(page, search);
    } catch (err) {
      console.error('Error updating role:', err);
      toast.error('Fehler', {
        description: err instanceof Error ? err.message : 'Rolle konnte nicht aktualisiert werden',
      });
      throw err; // Re-throw to let UserTable handle loading state
    }
  };

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

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Error Loading Users</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
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

      {loading && !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-muted-foreground">Benutzer werden geladen...</div>
        </div>
      ) : data ? (
        <UserTable
          users={data.users}
          total={data.total}
          page={data.page}
          limit={data.limit}
          onPageChange={handlePageChange}
          onSearch={handleSearch}
          onRoleUpdate={handleRoleUpdate}
          onPasswordReset={handlePasswordReset}
        />
      ) : null}
    </div>
  );
}
