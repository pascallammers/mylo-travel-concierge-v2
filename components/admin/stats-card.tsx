'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  iconClassName?: string;
}

/**
 * Reusable statistics card component for admin dashboard
 * @param title - Card title
 * @param value - Primary value to display
 * @param description - Optional description/subtitle
 * @param icon - Lucide icon component
 * @param iconClassName - Optional className for icon styling
 */
export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName = 'text-muted-foreground',
}: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconClassName}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}
