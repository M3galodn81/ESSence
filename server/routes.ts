import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { default as setupSetupRoutes } from "./routes/setup";
import { default as setupUserRoutes } from "./routes/users";
import { default as setupHolidayRoutes } from "./routes/holiday";
import { default as setupLeaveManagementRoutes } from "./routes/leave-management";
import { default as setupPayslipRoutes } from "./routes/payslip";
import { default as setupScheduleRoutes } from "./routes/schedule";
import { default as setupAnnouncementRoutes } from "./routes/announcements";
import { default as setupReportRoutes } from "./routes/reports";
import { default as setupAttendanceRoutes } from "./routes/attendance";
import { default as setupLaborCostRoutes } from "./routes/labor-cost";
import { default as setupNotificationRoutes } from "./routes/notifications";
import { Permission, RolePermissions, Role } from "@/lib/permissions";

// Backend helper to check permissions based on the shared RBAC config
const hasServerPermission = (role: string, permission: Permission) => {
  const userPermissions = RolePermissions[role as Role] || [];
  return userPermissions.includes(permission);
};

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // --- Modular Routes ---
  app.use("/api/setup", setupSetupRoutes);
  app.use("/api/users", setupUserRoutes);
  app.use("/api/holidays", setupHolidayRoutes);
  app.use("/api/leave-management", setupLeaveManagementRoutes);
  app.use("/api/payslips", setupPayslipRoutes);
  app.use("/api/schedules", setupScheduleRoutes);
  app.use("/api/announcements", setupAnnouncementRoutes);
  app.use("/api/reports", setupReportRoutes);
  app.use("/api/attendance", setupAttendanceRoutes);
  app.use("/api/labor-cost", setupLaborCostRoutes);
  app.use("/api/notifications", setupNotificationRoutes);

  // --- Get Dashboard Stats ---
  app.get("/api/dashboard-stats", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
    }
    const user = req.user!;
    
    // Calculate leave balance
    const leaveRequests = await storage.getLeaveRequestsByUser(user.id);
    const approvedLeaves = leaveRequests.filter(req => req.status === 'approved');
    const usedDays = approvedLeaves.reduce((sum, req) => sum + req.days, 0);
    
    // Dynamic total instead of hardcoded 25
    const totalLeaves = (user.annualLeaveBalance || 15) + (user.sickLeaveBalance || 10);
    const leaveBalance = Math.max(0, totalLeaves - usedDays);
    
    // Check pending approvals using RBAC instead of hardcoded 'manager' string
    let pendingApprovals = 0;
    if (hasServerPermission(user.role, Permission.APPROVE_LEAVES)) {
      const pending = await storage.getPendingLeaveRequests(user.role === 'manager' ? user.id : undefined);
      pendingApprovals = pending.length;
    }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const weekSchedules = await storage.getSchedulesByUser(user.id, weekStart, weekEnd);
    
    const weeklyHours = weekSchedules.reduce((sum, schedule) => {
      if (schedule.startTime && schedule.endTime) {
        const hours = (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }
      return sum;
    }, 0);
    
    res.json({ leaveBalance: `${leaveBalance} days`, weeklyHours: `${weeklyHours.toFixed(1)} hrs`, pendingApprovals });
  });

  // --- Get Team Members ---
  app.get("/api/team", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
    }
    const user = req.user!;
    
    let teamMembers;

    // Use RBAC instead of hardcoded role strings
    if (hasServerPermission(user.role, Permission.VIEW_ALL_USERS)) {
      teamMembers = await storage.getAllUsers();
    } else if (hasServerPermission(user.role, Permission.VIEW_TEAM_ATTENDANCE) || user.role === 'manager') {
      teamMembers = await storage.getEmployeesForManager(user.id);
    } else {
      teamMembers = await storage.getAllEmployees();
    }
    res.json(teamMembers);
  });

  // --- Activity Logs (Own) ---
  app.get("/api/activities", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const activities = await storage.getActivitiesByUser(req.user!.id, limit);
    res.json(activities);
  });

  // --- All Activity Logs (System Audit) ---
  app.get("/api/activities/all", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
    }
    
    // Check for audit log permissions instead of hardcoding 'admin'
    if (!hasServerPermission(req.user!.role, Permission.VIEW_AUDIT_LOGS)) {
      return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view system audit logs." });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const activities = await storage.getAllActivities(limit);
    res.json(activities);
  });

  const httpServer = createServer(app);
  return httpServer;
}