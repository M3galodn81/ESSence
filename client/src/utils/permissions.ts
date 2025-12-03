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

const EMPLOYEE_FEATURES = [ROLES.EMPLOYEE];
const PAYROLL_FEATURES = [ROLES.PAYROLL_OFFICER];

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
 hasAnyRole(user, EMPLOYEE_FEATURES);

export const canViewDashoardLeaveBalance = canViewEmployeeDashboardFeatures;
export const canViewDashoardHoursThisWeek = canViewEmployeeDashboardFeatures;
export const canViewDashoardPendingApprovals = canViewEmployeeDashboardFeatures;
export const canViewDashoardWeekSchedule = canViewEmployeeDashboardFeatures;
export const canViewDashoardPendingTasks = canViewEmployeeDashboardFeatures;

// #endregion

// #region Announcement Features
export const canManageAnnouncements = (user?: User | null) =>
 hasAnyRole(user, MANAGEMENT_ROLES);

export const canEditAnnouncements = canManageAnnouncements
export const canHideAnnouncements = canManageAnnouncements
export const canDeleteAnnouncements = canManageAnnouncements

// #endregion

// #region Leave Management Features
export const canAcceptDenyLeaveRequest = (user?: User | null) =>
 hasAnyRole(user, MANAGEMENT_ROLES);

export const canViewLeaveDetails = canViewEmployeeDashboardFeatures;
// #endregion

// #region Reports


// #endregion


// #region My Profile Permissions

// #endregion

// ---------------------------------------

export const canAccessManagementTab = (user?: User | null) =>
 hasAnyRole(user, MANAGEMENT_ROLES);

// #region User Management 
export const canViewUserManagement = (user?: User | null) =>
 hasAnyRole(user, MANAGEMENT_ROLES);

export const canCreateUser = canViewUserManagement;
export const canEditUser = canViewUserManagement;
export const canDeleteUser = canViewUserManagement;
export const canChangeUserPassword = canViewUserManagement;
// #endregion

// #region Team Management 
export const canViewTeamManagement = (user?: User | null) =>
 hasAnyRole(user, MANAGEMENT_ROLES);

export const canAddTeamMember = canViewTeamManagement;
export const canEditTeamMember = canViewTeamManagement;
export const canRemoveTeamMember = canViewTeamManagement;

// #endregion

// #region Shift Management
export const canViewShiftManagement = (user?: User | null) =>
 hasAnyRole(user, MANAGEMENT_ROLES);

export const canCreateShift = canViewShiftManagement;
export const canEditShift = canViewShiftManagement;
export const canDeleteShift = canViewShiftManagement;

// #endregion

// #region Payslip Generator
export const canAccessPayslipManagement = (user?: User | null) =>
 hasAnyRole(user, PAYROLL_FEATURES);


// #endregion

// #region Labor Cost Analysis
export const canViewLaborCostAnalysis = (user?: User | null) =>
  hasAnyRole(user, [ROLES.MANAGER]);

export const canGenerateLaborCostReport = canViewLaborCostAnalysis;

// #endregion


