import type { User } from "@/hooks/use-auth";

// 1. Single source of truth for role strings
export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  EMPLOYEE: "employee",
  PAYROLL_OFFICER_: "payroll_officer"
} as const;

// 2. Define hierarchies or groups
const ADMIN_LEVEL = [ROLES.ADMIN, ROLES.MANAGER];

// 3. Refactored functions using the constants
export const isAdmin = (u?: User | null) => u?.role === ROLES.ADMIN;
export const isManager = (u?: User | null) => u?.role === ROLES.MANAGER;
export const isEmployee = (u?: User | null) => u?.role === ROLES.EMPLOYEE;

// 4. Consolidated permissions
export function canAccessManagementTab(user?: User | null): boolean {
  return !!user?.role && ADMIN_LEVEL.includes(user.role as any);
}

export const canManageAnnouncements = canAccessManagementTab;

// TODO Add more permission / move all permissions to be here
