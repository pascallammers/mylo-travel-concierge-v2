import { AdminNav } from '@/components/admin/admin-nav';
import { getUser } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Check if user is authenticated and has admin role
  const user = await getUser();

  if (!user) {
    redirect('/sign-in');
  }

  if (user.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="flex h-screen">
      <AdminNav />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
