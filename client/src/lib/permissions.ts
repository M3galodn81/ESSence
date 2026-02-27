// lib/permissions.ts

/**
 * 1. Define the Roles
 * These correspond to the `role` column in your `users` table.
 */
export enum Role {
    SUPERADMIN = 'superadmin',
    ADMIN = 'admin',
    HR = 'hr',
    PAYROLL = 'payroll',
    MANAGER = 'manager',
    EMPLOYEE = 'employee',
}

/**
 * 2. Define Granular Permissions
 * Mapped directly to the tables and actions in your Drizzle schema.
 */
export enum Permission {
    // #region User Management (`users` table)
    
    // Basic profile and profile page access
    VIEW_OWN_PROFILE = 'view:own_profile',

    // View other users (for managers, HR, payroll) - typically restricted in UI to just their department
    VIEW_ALL_USERS = 'view:all_users',

    // Create, update, delete users
    MANAGE_USERS = 'manage:users', 

    // Salary, civil status, full address
    VIEW_SENSITIVE_USER_DATA = 'view:sensitive_user_data', 

    // #endregion
    
    // #region ATTENDANCE (`attendance`, `breaks` tables)
    
    // Clocking in/out
    SUBMIT_ATTENDANCE = 'submit:attendance', // Clock in/out
    
    //View attendance records - scoped by role (own, team, all)
    VIEW_OWN_ATTENDANCE = 'view:own_attendance',
    VIEW_TEAM_ATTENDANCE = 'view:team_attendance',
    VIEW_ALL_ATTENDANCE = 'view:all_attendance',

    // Edit times, fix undertime/overtime
    MANAGE_ATTENDANCE = 'manage:attendance', 

    // #endregion

    // #region LEAVE MANAGEMENT (`leave_requests` table)

    SUBMIT_LEAVE_REQUEST = 'submit:leave_request',
    VIEW_OWN_LEAVES = 'view:own_leaves',
    VIEW_TEAM_LEAVES = 'view:team_leaves',
    VIEW_ALL_LEAVES = 'view:all_leaves',
    APPROVE_LEAVES = 'approve:leaves',
    MANAGE_LEAVE_BALANCES = 'manage:leave_balances', // Edit limits in users table

    // #endregion

    // #region PAYROLL & FINANCIALS (`payslips` table) 
    VIEW_OWN_PAYSLIP = 'view:own_payslip',
    VIEW_ALL_PAYSLIPS = 'view:all_payslips',
    MANAGE_PAYROLL = 'manage:payroll', // Generate payslips, edit earnings/deductions
    // #endregion

    // #region SCHEDULES (`schedules` table) ---
    VIEW_OWN_SCHEDULE = 'view:own_schedule',
    VIEW_TEAM_SCHEDULE = 'view:team_schedule',
    VIEW_ALL_SCHEDULES = 'view:all_schedules',
    MANAGE_SCHEDULES = 'manage:schedules', // Create/edit shifts, locations, roles
    // #endregion

    // #region INCIDENT REPORTS (`reports` table) ---
    SUBMIT_REPORT = 'submit:report',
    VIEW_OWN_REPORTS = 'view:own_reports', // Reports submitted by or assigned to user (NTE)
    VIEW_ALL_REPORTS = 'view:all_reports',
    MANAGE_REPORTS = 'manage:reports', // Change status, assign NTEs, resolve
    // #endregion

    // #region LABOR COST (`labor_cost_data` table) ---
    VIEW_LABOR_COST = 'view:labor_cost',
    MANAGE_LABOR_COST = 'manage:labor_cost', // Add/edit monthly financial metrics

    // #endregion

    // #region COMPANY WIDE (`announcements`, `holidays` tables) ---
    VIEW_ANNOUNCEMENTS = 'view:announcements',
    MANAGE_ANNOUNCEMENTS = 'manage:announcements',
    VIEW_HOLIDAYS = 'view:holidays',
    MANAGE_HOLIDAYS = 'manage:holidays',
    //#endregion

    // #region ATTENDANCE MANAGEMENT
    VIEW_ATTENDANCE_RECORDS = 'view:attendance_records',
    MANAGE_ATTENDANCE_RECORDS = 'manage:attendance_records',

    // #endregion

    // #region SYSTEM AUDIT (`activities` table) ---
    VIEW_AUDIT_LOGS = 'view:audit_logs',
    // #endregion
}

/**
 * 3. Map Roles to Permissions
 */
export const RolePermissions: Record<Role, Permission[]> = {
    // =========================================================
    // SUPERADMIN: Has access to everything
    // =========================================================
    [Role.SUPERADMIN]: Object.values(Permission),
    
    // =========================================================
    // ADMIN: Can manage users, attendance, leaves, and reports across the board
    // =========================================================
    [Role.ADMIN]: [
        Permission.MANAGE_USERS,
        Permission.VIEW_ALL_USERS,
        Permission.VIEW_SENSITIVE_USER_DATA,
        Permission.MANAGE_ANNOUNCEMENTS,
        Permission.VIEW_ANNOUNCEMENTS,
    ],


    // =========================================================
    // HR: Manages people, policies, attendance, and incidents
    // =========================================================
    [Role.HR]: [
        Permission.VIEW_OWN_PROFILE,
        Permission.VIEW_ALL_USERS,
        Permission.MANAGE_USERS,
        Permission.VIEW_SENSITIVE_USER_DATA,
        
        Permission.SUBMIT_ATTENDANCE,
        Permission.VIEW_OWN_ATTENDANCE,
        Permission.VIEW_ALL_ATTENDANCE,
        Permission.MANAGE_ATTENDANCE,
        
        Permission.SUBMIT_LEAVE_REQUEST,
        Permission.VIEW_OWN_LEAVES,
        Permission.VIEW_ALL_LEAVES,
        Permission.APPROVE_LEAVES,
        Permission.MANAGE_LEAVE_BALANCES,
        
        Permission.VIEW_OWN_PAYSLIP,
        
        Permission.VIEW_OWN_SCHEDULE,
        Permission.VIEW_ALL_SCHEDULES,
        
        Permission.SUBMIT_REPORT,
        Permission.VIEW_OWN_REPORTS,
        Permission.VIEW_ALL_REPORTS,
        Permission.MANAGE_REPORTS, // HR typically handles NTEs and resolutions
        
        Permission.VIEW_ANNOUNCEMENTS,
        Permission.MANAGE_ANNOUNCEMENTS,
        Permission.VIEW_HOLIDAYS,
        Permission.MANAGE_HOLIDAYS,
        
        Permission.VIEW_AUDIT_LOGS,
    ],

    // =========================================================
    // PAYROLL: Focused entirely on timesheets and money
    // =========================================================
    [Role.PAYROLL]: [
        Permission.VIEW_OWN_PROFILE,
        Permission.VIEW_ALL_USERS,
        Permission.VIEW_SENSITIVE_USER_DATA, // Needs to see base salary, allowances
        
        Permission.SUBMIT_ATTENDANCE,
        Permission.VIEW_OWN_ATTENDANCE,
        Permission.VIEW_ALL_ATTENDANCE, // Needs to verify hours worked
        
        Permission.SUBMIT_LEAVE_REQUEST,
        Permission.VIEW_OWN_LEAVES,
        Permission.VIEW_ALL_LEAVES, // Needs to verify paid vs unpaid leaves
        
        Permission.VIEW_OWN_PAYSLIP,
        Permission.VIEW_ALL_PAYSLIPS,
        Permission.MANAGE_PAYROLL,
        
        Permission.VIEW_OWN_SCHEDULE,
        
        Permission.SUBMIT_REPORT,
        Permission.VIEW_OWN_REPORTS,
        
        Permission.VIEW_LABOR_COST,
        Permission.MANAGE_LABOR_COST,
        
        Permission.VIEW_ANNOUNCEMENTS,
        Permission.VIEW_HOLIDAYS,
    ],

    // =========================================================
    // MANAGER: Focused on their team's ops, schedules, and leaves
    // =========================================================
    [Role.MANAGER]: [
        Permission.VIEW_OWN_PROFILE,
        Permission.VIEW_ALL_USERS, // Usually restricted in UI to just their department
        
        Permission.SUBMIT_ATTENDANCE,
        Permission.VIEW_OWN_ATTENDANCE,
        Permission.VIEW_TEAM_ATTENDANCE,
        
        Permission.SUBMIT_LEAVE_REQUEST,
        Permission.VIEW_OWN_LEAVES,
        Permission.VIEW_TEAM_LEAVES,
        Permission.APPROVE_LEAVES,
        
        Permission.VIEW_OWN_PAYSLIP,
        
        Permission.VIEW_OWN_SCHEDULE,
        Permission.VIEW_TEAM_SCHEDULE,
        Permission.MANAGE_SCHEDULES,
        
        Permission.SUBMIT_REPORT,
        Permission.VIEW_OWN_REPORTS,
        Permission.VIEW_ALL_REPORTS, // Managers need to see all reports from their team
        
        Permission.VIEW_LABOR_COST, // Managers often need to track their branch/department cost
        
        Permission.VIEW_ANNOUNCEMENTS,
        Permission.MANAGE_ANNOUNCEMENTS, // E.g., targetting their department
        Permission.VIEW_HOLIDAYS,
    ],

    // =========================================================
    // EMPLOYEE: Self-service access only
    // =========================================================
    [Role.EMPLOYEE]: [
        Permission.VIEW_OWN_PROFILE,
        
        Permission.SUBMIT_ATTENDANCE,
        Permission.VIEW_OWN_ATTENDANCE,
        
        Permission.SUBMIT_LEAVE_REQUEST,
        Permission.VIEW_OWN_LEAVES,
        
        Permission.VIEW_OWN_PAYSLIP,
        Permission.VIEW_OWN_SCHEDULE,
        
        Permission.SUBMIT_REPORT,
        Permission.VIEW_OWN_REPORTS, // Can see reports they filed or NTEs assigned to them
        
        Permission.VIEW_ANNOUNCEMENTS,
        Permission.VIEW_HOLIDAYS, 
    ],
};