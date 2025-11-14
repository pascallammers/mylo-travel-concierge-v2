'use client';

import { Badge } from '@/components/ui/badge';

interface RoleBadgeProps {
  role: 'user' | 'admin';
}

/**
 * Badge component to display user role
 * @param role - User role ('user' or 'admin')
 */
export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>
  );
}
