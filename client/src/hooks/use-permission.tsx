// hooks/use-permission.ts
import { useAuth } from "@/hooks/use-auth";
import { Permission, RolePermissions, Role } from "@/lib/permissions";

export function usePermission() {
  const { user } = useAuth();

  /**
   * Checks if the current user has a specific permission
   */
  const hasPermission = (permission: Permission): boolean => {
    if (!user || !user.role) return false;
    
    // Fallback to empty array if role isn't mapped
    const userRole = user.role as Role;
    const permissions = RolePermissions[userRole] || [];
    
    return permissions.includes(permission);
  };

  /**
   * Checks if the user has ANY of the provided permissions
   */
  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(hasPermission);
  };

  /**
   * Checks if the user has ALL of the provided permissions
   */
  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(hasPermission);
  };

  return { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions,
    role: user?.role as Role | undefined
  };
}