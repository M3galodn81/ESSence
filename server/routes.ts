import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import {
  insertLeaveRequestSchema,
  insertAnnouncementSchema,
  insertDocumentSchema,
  insertScheduleSchema,
  insertScheduleApiSchema,
  insertReportSchema,
  insertLaborCostDataSchema
} from "@shared/schema";
import { z } from "zod";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  app.get("/api/setup/check", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const hasAdmin = users && users.length > 0 && users.some(u => u.role === "admin");
      res.json({ needsSetup: !hasAdmin });
    } catch (error) {
      console.error("Setup check error:", error);
      
      res.json({ needsSetup: true });
    }
  });

  app.post("/api/setup/admin", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const hasAdmin = users.some(u => u.role === "admin");

      if (hasAdmin) {
        return res.status(400).send("Admin account already exists");
      }

      const adminData = {
        ...req.body,
        password: await hashPassword(req.body.password),
        role: "admin",
        department: "Administration",
        position: "System Administrator",
      };

      const admin = await storage.createUser(adminData);
      res.json(admin);
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to create admin account");
    }
  });

  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'manager') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    const requestedRole = req.body.role;

    if (user.role === 'manager' && requestedRole !== 'employee') {
      return res.status(403).send("Managers can only create employee accounts");
    }
    if (user.role === 'admin' && requestedRole !== 'manager') {
      return res.status(403).send("Admins can only create manager accounts");
    }
    if (user.role !== 'admin' && user.role !== 'manager') {
      return res.status(403).send("Access denied");
    }

    try {
      const userData = {
        ...req.body,
        password: await hashPassword(req.body.password),
      };

      // Handle managerId for different roles
      if (user.role === 'manager' && requestedRole === 'employee' && !userData.managerId) {
        userData.managerId = user.id;
      }

      // For managers created by admin, ensure managerId is either null or empty string
      if (requestedRole === 'manager') {
        // Managers typically don't have a manager, or they report to admin
        // Set to null/undefined to avoid foreign key constraint issues
        if (!userData.managerId || userData.managerId === '') {
          delete userData.managerId;
        } else {
          // Validate that the managerId exists if provided
          const managerExists = await storage.getUser(userData.managerId);
          if (!managerExists) {
            return res.status(400).send("Invalid manager ID provided");
          }
        }
      }

      const newUser = await storage.createUser(userData);
      res.json(newUser);
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to create user");
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'admin') {
      return res.status(403).send("Only admins can edit users");
    }

    try {
      const updatedUser = await storage.updateUser(req.params.id, req.body);
      if (!updatedUser) {
        return res.status(404).send("User not found");
      }
      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to update user");
    }
  });

  app.patch("/api/users/:id/password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'admin') {
      return res.status(403).send("Only admins can change passwords");
    }

    try {
      const hashedPassword = await hashPassword(req.body.password);
      const updatedUser = await storage.updateUser(req.params.id, {
        password: hashedPassword,
      });
      if (!updatedUser) {
        return res.status(404).send("User not found");
      }
      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to change password");
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'admin') {
      return res.status(403).send("Only admins can delete users");
    }

    if (user.id === req.params.id) {
      return res.status(400).send("You cannot delete your own account");
    }

    try {
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to delete user");
    }
  });

  app.post("/api/leave-requests", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const leaveData = insertLeaveRequestSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });
      const leaveRequest = await storage.createLeaveRequest(leaveData);
      res.json(leaveRequest);
    } catch (error) {
      res.status(400).json({ message: "Invalid leave request data" });
    }
  });

  app.get("/api/leave-requests", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const leaveRequests = await storage.getLeaveRequestsByUser(req.user!.id);
    res.json(leaveRequests);
  });

  app.get("/api/leave-requests/pending", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    const pendingRequests = await storage.getPendingLeaveRequests(
      user.role === 'manager' ? user.id : undefined
    );
    res.json(pendingRequests);
  });

  app.patch("/api/leave-requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const updates = z.object({
        status: z.enum(["approved", "rejected"]),
        comments: z.string().optional(),
      }).parse(req.body);

      const updatedRequest = await storage.updateLeaveRequest(req.params.id, {
        ...updates,
        approvedBy: user.id,
        approvedAt: new Date(),
      });

      if (!updatedRequest) {
        return res.status(404).json({ message: "Leave request not found" });
      }

      res.json(updatedRequest);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  app.get("/api/payslips", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const payslips = await storage.getPayslipsByUser(req.user!.id);
    res.json(payslips);
  });

  app.post("/api/payslips", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const payslip = await storage.createPayslip(req.body);
      res.json(payslip);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create payslip" });
    }
  });

  app.get("/api/payslips/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const payslip = await storage.getPayslipById(req.params.id);
    if (!payslip || payslip.userId !== req.user!.id) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    res.json(payslip);
  });

  app.get("/api/schedules", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { startDate, endDate } = req.query;
    const schedules = await storage.getSchedulesByUser(
      req.user!.id,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.json(schedules);
  });

  app.post("/api/schedules", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      
      const apiData = insertScheduleApiSchema.parse(req.body);
      
      const scheduleData = {
        ...apiData,
        date: new Date(apiData.date),
        startTime: new Date(apiData.startTime),
        endTime: new Date(apiData.endTime),
      };
      const schedule = await storage.createSchedule(scheduleData);
      res.json(schedule);
    } catch (error: any) {
      console.error("Schedule validation error:", error);
      res.status(400).json({ message: "Invalid schedule data", error: error.message });
    }
  });

  app.get("/api/schedules/all", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    const { startDate, endDate } = req.query;
    const schedules = await storage.getAllSchedules(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.json(schedules);
  });

  app.patch("/api/schedules/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const schedule = await storage.updateSchedule(req.params.id, req.body);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      res.status(400).json({ message: "Failed to update schedule" });
    }
  });

  app.delete("/api/schedules/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const success = await storage.deleteSchedule(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json({ message: "Schedule deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: "Failed to delete schedule" });
    }
  });

  app.post("/api/schedules/copy-week", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const { sourceWeekStart, targetWeekStart } = req.body;
      const sourceStart = new Date(sourceWeekStart);
      const sourceEnd = new Date(sourceStart);
      sourceEnd.setDate(sourceStart.getDate() + 6);

      const sourceSchedules = await storage.getAllSchedules(sourceStart, sourceEnd);

      const targetStart = new Date(targetWeekStart);
      const daysDiff = Math.floor((targetStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24));

      const newSchedules = [];
      for (const schedule of sourceSchedules) {
        const newDate = new Date(schedule.date);
        newDate.setDate(newDate.getDate() + daysDiff);

        const newStartTime = new Date(schedule.startTime);
        newStartTime.setDate(newStartTime.getDate() + daysDiff);

        const newEndTime = new Date(schedule.endTime);
        newEndTime.setDate(newEndTime.getDate() + daysDiff);

        const newSchedule = await storage.createSchedule({
          userId: schedule.userId,
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          type: schedule.type,
          title: schedule.title,
          description: schedule.description,
          location: schedule.location,
          shiftRole: schedule.shiftRole,
          isAllDay: schedule.isAllDay,
        });
        newSchedules.push(newSchedule);
      }

      res.json({ message: `Copied ${newSchedules.length} shifts`, schedules: newSchedules });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to copy schedule" });
    }
  });

  app.get("/api/documents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const documents = await storage.getDocumentsByUser(req.user!.id);
    res.json(documents);
  });

  app.post("/api/documents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const documentData = insertDocumentSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });
      const document = await storage.createDocument(documentData);
      res.json(document);
    } catch (error) {
      res.status(400).json({ message: "Invalid document data" });
    }
  });

  app.get("/api/announcements", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const announcements = await storage.getActiveAnnouncements(req.user!.department || undefined);
    res.json(announcements);
  });

  app.post("/api/announcements", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'hr' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const announcementData = insertAnnouncementSchema.parse({
        ...req.body,
        authorId: user.id,
      });
      const announcement = await storage.createAnnouncement(announcementData);
      res.json(announcement);
    } catch (error) {
      res.status(400).json({ message: "Invalid announcement data" });
    }
  });

  app.get("/api/activities", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const activities = await storage.getActivitiesByUser(req.user!.id, limit);
    res.json(activities);
  });

  app.get("/api/trainings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const trainings = await storage.getAllTrainings();
    res.json(trainings);
  });

  app.get("/api/user-trainings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const userTrainings = await storage.getUserTrainings(req.user!.id);
    res.json(userTrainings);
  });

  app.patch("/api/user-trainings/:trainingId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const updates = z.object({
        status: z.enum(["not_started", "in_progress", "completed"]).optional(),
        progress: z.number().min(0).max(100).optional(),
      }).parse(req.body);

      if (updates.status === 'completed') {
        updates.progress = 100;
      }

      const userTraining = await storage.updateUserTraining(
        req.user!.id,
        req.params.trainingId,
        updates
      );

      res.json(userTraining);
    } catch (error) {
      res.status(400).json({ message: "Invalid training update data" });
    }
  });

  app.patch("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const allowedUpdates = z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phoneNumber: z.string().optional(),
        emergencyContact: z.any().optional(),
        address: z.any().optional(),
      }).parse(req.body);

      const updatedUser = await storage.updateUser(req.user!.id, allowedUpdates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.createActivity({
        userId: req.user!.id,
        type: "profile_updated",
        description: "Profile information updated",
        metadata: { updatedFields: Object.keys(allowedUpdates) },
      });

      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ message: "Invalid profile update data" });
    }
  });

  app.get("/api/team", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    let teamMembers;
    if (user.role === 'admin') {
      
      const allUsers = await storage.getAllUsers();
      teamMembers = allUsers.filter((u: any) => u.role === 'employee');
    } else {
      
      teamMembers = await storage.getEmployeesForManager(user.id);
    }

    res.json(teamMembers);
  });

  app.get("/api/dashboard-stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;

    const leaveRequests = await storage.getLeaveRequestsByUser(user.id);
    const approvedLeaves = leaveRequests.filter(req => req.status === 'approved');
    const usedDays = approvedLeaves.reduce((sum, req) => sum + req.days, 0);
    const leaveBalance = Math.max(0, 25 - usedDays);

    let pendingApprovals = 0;
    if (user.role === 'manager' || user.role === 'hr') {
      const pending = await storage.getPendingLeaveRequests(
        user.role === 'manager' ? user.id : undefined
      );
      pendingApprovals = pending.length;
    }

    const userTrainings = await storage.getUserTrainings(user.id);
    const completedTrainings = userTrainings.filter(ut => ut.status === 'completed');
    const allTrainings = await storage.getAllTrainings();
    const requiredTrainings = allTrainings.filter(t => t.isMandatory);
    const trainingProgress = requiredTrainings.length > 0
      ? Math.round((completedTrainings.length / requiredTrainings.length) * 100)
      : 0;
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

    const stats = {
      leaveBalance: `${leaveBalance} days`,
      weeklyHours: `${weeklyHours.toFixed(1)} hrs`,
      pendingApprovals,
      trainingProgress: `${trainingProgress}%`,
    };

    res.json(stats);
  });

  app.post("/api/reports", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const reportData = insertReportSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });
      const report = await storage.createReport(reportData);
      res.json(report);
    } catch (error) {
      res.status(400).json({ message: "Invalid report data" });
    }
  });

  app.get("/api/reports", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role === 'manager' || user.role === 'hr') {
      const reports = await storage.getAllReports();
      res.json(reports);
    } else {
      const reports = await storage.getReportsByUser(user.id);
      res.json(reports);
    }
  });

  app.get("/api/reports/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const report = await storage.getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin' && report.userId !== user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(report);
  });

  app.patch("/api/reports/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const updates = z.object({
        status: z.enum(["pending", "investigating", "resolved", "closed"]).optional(),
        assignedTo: z.string().optional(),
        resolvedBy: z.string().optional(),
        resolvedAt: z.date().optional(),
        notes: z.string().optional(),
      }).parse(req.body);

      const updatedReport = await storage.updateReport(req.params.id, updates);
      if (!updatedReport) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(updatedReport);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  app.post("/api/labor-cost-data", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'hr') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const data = insertLaborCostDataSchema.parse(req.body);
      const laborCost = await storage.createLaborCostData(data);
      res.json(laborCost);
    } catch (error) {
      res.status(400).json({ message: "Invalid labor cost data" });
    }
  });

  app.get("/api/labor-cost-data", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'hr') {
      return res.status(403).json({ message: "Access denied" });
    }

    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const data = await storage.getLaborCostData(year);
    res.json(data);
  });

  app.get("/api/labor-cost-data/:month/:year", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'hr') {
      return res.status(403).json({ message: "Access denied" });
    }

    const month = parseInt(req.params.month);
    const year = parseInt(req.params.year);
    const data = await storage.getLaborCostDataByMonth(month, year);

    if (!data) {
      return res.status(404).json({ message: "Data not found" });
    }

    res.json(data);
  });

  app.patch("/api/labor-cost-data/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'hr') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const updates = z.object({
        totalSales: z.number().optional(),
        totalLaborCost: z.number().optional(),
        laborCostPercentage: z.number().optional(),
        status: z.string().optional(),
        performanceRating: z.string().optional(),
        notes: z.string().optional(),
      }).parse(req.body);

      const updatedData = await storage.updateLaborCostData(req.params.id, updates);
      if (!updatedData) {
        return res.status(404).json({ message: "Data not found" });
      }

      res.json(updatedData);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
