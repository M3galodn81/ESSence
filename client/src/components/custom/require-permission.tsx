// components/RequirePermission.tsx
import React from 'react';
import { usePermission } from '@/hooks/use-permission';
import { Permission } from '@/lib/permissions';

interface RequirePermissionProps {
  permission: Permission | Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({
  permission,
  requireAll = false,
  fallback = null,
  children,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermission();

  // Normalize to array
  const permissions = Array.isArray(permission) ? permission : [permission];

  // Determine authorization based on strategy
  const isAuthorized = requireAll
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);

  if (!isAuthorized) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};