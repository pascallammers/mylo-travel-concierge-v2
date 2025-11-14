import { AdminNav } from '@/components/admin/admin-nav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <AdminNav />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
