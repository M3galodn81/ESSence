import type { User } from "@/hooks/use-auth";

// 1. Single source of truth for role strings
export const ROLES = {
 ADMIN: "admin",
 MANAGER: "manager",
 EMPLOYEE: "employee",
 PAYROLL_OFFICER: "payroll_officer"
} as const;

// Define the type for all possible role values for better type safety
export type Role = typeof ROLES[keyof typeof ROLES];

// 2. Define hierarchies/groups
const ALL_ROLES = [ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.PAYROLL_OFFICER]
const MANAGEMENT_ROLES = [ROLES.ADMIN, ROLES.MANAGER] as const;
const HR_ROLES = [ROLES.ADMIN, ROLES.PAYROLL_OFFICER, ROLES.MANAGER] as const;

const EMPLOYEE_DASHBOARD_FEATURES = [ROLES.EMPLOYEE];

// 3. Simple role checks (Using a factory function)
const hasRole = (role: Role) => (u?: User | null) => u?.role === role;

export const isAdmin = hasRole(ROLES.ADMIN);
export const isManager = hasRole(ROLES.MANAGER);
export const isPayrollOfficer = hasRole(ROLES.PAYROLL_OFFICER);
export const isEmployee = hasRole(ROLES.EMPLOYEE);


// 4. Consolidated permissions (Centralized Check Function)

/**
 * Checks if the user has any of the specified allowed roles.
 */
export function hasAnyRole(
 user: User | null | undefined,
 allowedRoles: readonly Role[]
): boolean {
 // Explicitly cast the constant array to Role[] to avoid TS errors when checking includes
 return !!user?.role && (allowedRoles as readonly Role[]).includes(user.role);
}

// Permission Functions

// #region Dashboard Features
export const canViewEmployeeDashboardFeatures = (user?: User | null) =>
 hasAnyRole(user, EMPLOYEE_DASHBOARD_FEATURES);

export const canViewDashoardLeaveBalance = canViewEmployeeDashboardFeatures;
export const canViewDashoardHoursThisWeek = canViewEmployeeDashboardFeatures;
export const canViewDashoardPendingApprovals = canViewEmployeeDashboardFeatures;
export const canViewDashoardWeekSchedule = canViewEmployeeDashboardFeatures;
export const canViewDashoardPendingTasks = canViewEmployeeDashboardFeatures;

// #endregion

// #region Announcement Features
export const canMakeAnnouncements = (user?: User | null) =>
 hasAnyRole(user, MANAGEMENT_ROLES);

export const canEditAnnouncements = canMakeAnnouncements
export const canHideAnnouncements = canMakeAnnouncements
export const canDeleteAnnouncements = canMakeAnnouncements

// #endregion

// #region Leave Management Features
export const canAcceptDenyLeaveRequest = (user?: User | null) =>
 hasAnyRole(user, MANAGEMENT_ROLES);
// #endregion


// #region Reports

// #endregion


// #region My Profile Permissions

// #endregion

// ---------------------------------------
// #region User Management 

// #endregion

// #region Team Management 

// #endregion

// #region Shift Management

// #endregion

// #region Payslip Generator

// #endregion

// #region Labor Cost Analysis

// #endregion


export const canAccessManagementTab = (user?: User | null) =>
 hasAnyRole(user, MANAGEMENT_ROLES);

export const canManageAnnouncements = canAccessManagementTab;

export const canViewPayrollData = (user?: User | null) =>
  hasAnyRole(user, HR_ROLES);