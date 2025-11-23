
import type { User } from "@/hooks/use-auth";

export function canManageAnnouncements(user?: User | null): boolean {
  return user?.role === "admin" || user?.role === "manager";
}

export function canAccessManagementTab(user?: User | null): boolean {
  return user?.role === "admin" || user?.role === "manager";
}

export function isAdmin(user?: User | null): boolean {
  return user?.role === "admin";
}

export function isManager(user?: User | null): boolean {
  return user?.role === "manager";
}

export function isEmployee(user?: User | null): boolean {
  return user?.role === "employee";
}