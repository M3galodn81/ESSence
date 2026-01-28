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
import {default as setupLaborCostRoutes} from "./routes/labor-cost";
import {default as setupNotificationRoutes} from "./routes/notifications";

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
    // ... [Keep existing dashboard-stats code] ...
     if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    const leaveRequests = await storage.getLeaveRequestsByUser(user.id);
    const approvedLeaves = leaveRequests.filter(req => req.status === 'approved');
    const usedDays = approvedLeaves.reduce((sum, req) => sum + req.days, 0);
    const leaveBalance = Math.max(0, 25 - usedDays);
    let pendingApprovals = 0;
    if (user.role === 'manager' || user.role === 'hr') {
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
      if (schedule.type === 'work' && schedule.startTime && schedule.endTime) {
        const hours = (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }
      return sum;
    }, 0);
    res.json({ leaveBalance: `${leaveBalance} days`, weeklyHours: `${weeklyHours.toFixed(1)} hrs`, pendingApprovals });
  });

  // --- Get Team Members ---
  app.get("/api/team", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    
    if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'payroll_officer')
      {
        return res.status(403).json({ message: "Access denied" });
      }
    let teamMembers;

    if (user.role === 'admin' || user.role === 'payroll_officer') {
      teamMembers = await storage.getAllUsers();
    }
    else {
      teamMembers = await storage.getEmployeesForManager(user.id);
    }  
    res.json(teamMembers);
  });

  // --- Activity Logs ---
  app.get("/api/activities", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const activities = await storage.getActivitiesByUser(req.user!.id, limit);
    res.json(activities);
  });

  // --- All Activity Logs ---
  app.get("/api/activities/all", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const activities = await storage.getAllActivities(limit);
    res.json(activities);
  });

  const httpServer = createServer(app);
  return httpServer;
}