'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, BarChart3, ArrowLeft, FileText, AlertCircle, Webhook, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: 'Business KPIs',
    href: '/admin/kpi',
    icon: TrendingUp,
  },
  {
    title: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
  },
  {
    title: 'Knowledge Base',
    href: '/admin/knowledge-base',
    icon: FileText,
  },
  {
    title: 'ThriveCart',
    href: '/admin/thrivecart',
    icon: Webhook,
  },
  {
    title: 'Fehlgeschlagene Suchen',
    href: '/admin/failed-searches',
    icon: AlertCircle,
  },
];

interface AdminNavProps {
  showKpi?: boolean;
}

/**
 * Admin navigation sidebar
 */
export function AdminNav({ showKpi = false }: AdminNavProps) {
  const pathname = usePathname();

  const visibleItems = showKpi
    ? navItems
    : navItems.filter((item) => item.href !== '/admin/kpi');

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/10 px-4 py-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Admin Panel</h2>
      </div>

      <nav className="flex-1 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                isActive && 'bg-accent',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4">
        <Link href="/">
          <Button variant="outline" className="w-full" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to App
          </Button>
        </Link>
      </div>
    </div>
  );
}
