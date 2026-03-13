import { isKpiAuthorized } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';

export default async function KpiLayout({ children }: { children: React.ReactNode }) {
  const authorized = await isKpiAuthorized();
  if (!authorized) {
    redirect('/admin');
  }
  return <>{children}</>;
}
