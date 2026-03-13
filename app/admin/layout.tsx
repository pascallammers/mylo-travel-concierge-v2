import { AdminNav } from '@/components/admin/admin-nav';
import { getUser, getUserRole, isKpiAuthorized } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Check if user is authenticated and has admin role
  const user = await getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Get role directly from database (session might not have it after role was added)
  const userRole = await getUserRole(user.id);

  if (userRole !== 'admin') {
    redirect('/');
  }

  const showKpi = await isKpiAuthorized();

  return (
    <div className="flex h-screen">
      <AdminNav showKpi={showKpi} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
