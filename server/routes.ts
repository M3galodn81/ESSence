import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  insertLeaveRequestSchema, 
  insertAnnouncementSchema, 
  insertDocumentSchema,
  insertScheduleSchema 
} from "@shared/schema";
import { z } from "zod";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

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
    if (user.role !== 'manager' && user.role !== 'hr') {
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
    if (user.role !== 'manager' && user.role !== 'hr') {
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
    if (user.role !== 'manager' && user.role !== 'hr') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const scheduleData = insertScheduleSchema.parse(req.body);
      const schedule = await storage.createSchedule(scheduleData);
      res.json(schedule);
    } catch (error) {
      res.status(400).json({ message: "Invalid schedule data" });
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
    if (user.role !== 'manager' && user.role !== 'hr') {
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
    if (user.role !== 'manager' && user.role !== 'hr') {
      return res.status(403).json({ message: "Access denied" });
    }

    const teamMembers = user.role === 'manager' 
      ? await storage.getUsersByManager(user.id)
      : await storage.getUsersByDepartment(user.department!);
    
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

  const httpServer = createServer(app);
  return httpServer;
}
