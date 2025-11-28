import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import {
  insertLeaveRequestSchema,
  insertAnnouncementSchema,
  insertScheduleApiSchema,
  insertReportSchema,
  insertLaborCostDataSchema,
  insertHolidaySchema,
  payslips,
  holidays
} from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import { db } from "./db";
import { attendance, breaks, activities } from "@shared/schema";
import { eq, and, gte, lte, isNull, desc, inArray } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Helper: Get Start/End of a specific date for Attendance queries
  // FIX: Returns Date objects instead of timestamps to satisfy Drizzle types
  const getDayRange = (dateObj: Date) => {
    const start = new Date(dateObj);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateObj);
    end.setHours(23, 59, 59, 999);
    return { start, end }; 
  };

  // --- Setup & Admin ---
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
      if (hasAdmin) return res.status(400).send("Admin account already exists");

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

  // --- User Management ---
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'manager') return res.status(403).json({ message: "Access denied" });
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

    if (user.role === 'manager' && requestedRole !== 'employee') return res.status(403).send("Managers can only create employee accounts");
    if (user.role !== 'admin' && user.role !== 'manager') return res.status(403).send("Access denied");

    try {
      const userData = { ...req.body, password: await hashPassword(req.body.password) };
      if (user.role === 'manager' && requestedRole === 'employee' && !userData.managerId) userData.managerId = user.id;
      if (requestedRole === 'manager') {
        if (!userData.managerId || userData.managerId === '') delete userData.managerId;
        else {
          const managerExists = await storage.getUser(userData.managerId);
          if (!managerExists) return res.status(400).send("Invalid manager ID provided");
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
    if (req.user!.role !== 'admin') return res.status(403).send("Only admins can edit users");
    try {
      const updatedUser = await storage.updateUser(req.params.id, req.body);
      if (!updatedUser) return res.status(404).send("User not found");
      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to update user");
    }
  });

  app.patch("/api/users/:id/password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user!.role !== 'admin') return res.status(403).send("Only admins can change passwords");
    try {
      const hashedPassword = await hashPassword(req.body.password);
      const updatedUser = await storage.updateUser(req.params.id, { password: hashedPassword });
      if (!updatedUser) return res.status(404).send("User not found");
      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to change password");
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'admin') return res.status(403).send("Only admins can delete users");
    if (user.id === req.params.id) return res.status(400).send("You cannot delete your own account");
    try {
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to delete user");
    }
  });

  // --- Holiday Management Routes ---
  app.get("/api/holidays", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const allHolidays = await db.select().from(holidays);
    res.json(allHolidays);
  });

  app.post("/api/holidays", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user!.role !== 'payroll_officer' && req.user!.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    
    try {
      const data = insertHolidaySchema.parse({
        ...req.body,
        date: new Date(req.body.date),
      });
      const holiday = await db.insert(holidays).values(data).returning();
      res.json(holiday[0]);
    } catch (error) {
      res.status(400).json({ message: "Invalid holiday data" });
    }
  });

  app.delete("/api/holidays/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
     if (req.user!.role !== 'payroll_officer' && req.user!.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    
    await db.delete(holidays).where(eq(holidays.id, req.params.id));
    res.json({ message: "Holiday deleted" });
  });

  // --- Leave Requests ---
  app.post("/api/leave-requests", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const apiData = insertLeaveRequestSchema.parse({
        ...req.body,
        userId: req.user!.id,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      });
      const leaveRequest = await storage.createLeaveRequest(apiData);
      res.json(leaveRequest);
    } catch (error) {
      if (error instanceof ZodError) return res.status(400).json({ message: "Invalid leave request data", debug: error.errors });
      return res.sendStatus(500);
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
    if (user.role !== 'manager' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    const pendingRequests = await storage.getPendingLeaveRequests(user.role === 'manager' ? user.id : undefined);
    res.json(pendingRequests);
  });

  app.patch("/api/leave-requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    try {
      const updates = z.object({
        status: z.enum(["approved", "rejected"]),
        comments: z.string().optional(),
      }).parse(req.body);
      const updatedRequest = await storage.updateLeaveRequest(req.params.id, { ...updates, approvedBy: user.id, approvedAt: new Date() });
      if (!updatedRequest) return res.status(404).json({ message: "Leave request not found" });
      res.json(updatedRequest);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  // --- Payslips Routes ---
  app.get("/api/payslips", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    
    // Admin/Payroll Officer: Fetch All
    if (req.query.all === 'true' && (user.role === 'payroll_officer' || user.role === 'admin')) {
        try {
            const all = await db.query.payslips.findMany();
            return res.json(all);
        } catch (e) {
            console.error("Fetch all payslips error:", e);
            return res.status(500).json({ message: "Failed to fetch all payslips" });
        }
    }

    // Manager: Fetch Team + Self
    if (req.query.all === 'true' && user.role === 'manager') {
        try {
            const team = await storage.getEmployeesForManager(user.id);
            const ids = team.map(u => u.id);
            ids.push(user.id); 
            
            const teamPayslips = await db.query.payslips.findMany({
                where: inArray(payslips.userId, ids)
            });
            return res.json(teamPayslips);
        } catch (e) {
            console.error("Fetch manager payslips error:", e);
            return res.status(500).json({ message: "Failed to fetch team payslips" });
        }
    }

    // Default: By User
    const result = await storage.getPayslipsByUser(user.id);
    res.json(result);
  });

  app.post("/api/payslips", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user!.role !== 'payroll_officer' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
    }
    try {
      const payslip = await storage.createPayslip(req.body);
      res.json(payslip);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create payslip" });
    }
  });

  app.patch("/api/payslips/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'payroll_officer' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });

    try {
      const updated = await db.update(payslips)
        .set(req.body)
        .where(eq(payslips.id, req.params.id))
        .returning();
      
      if (!updated.length) return res.status(404).json({ message: "Payslip not found" });
      res.json(updated[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/payslips/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'payroll_officer' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });

    try {
      const deleted = await db.delete(payslips)
        .where(eq(payslips.id, req.params.id))
        .returning();
      
      if (!deleted.length) return res.status(404).json({ message: "Payslip not found" });
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // --- Schedules ---
  app.get("/api/schedules", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { startDate, endDate } = req.query;
    const schedules = await storage.getSchedulesByUser(req.user!.id, startDate ? new Date(startDate as string) : undefined, endDate ? new Date(endDate as string) : undefined);
    res.json(schedules);
  });

  app.post("/api/schedules", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });
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
    if (user.role !== 'manager' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    const { startDate, endDate } = req.query;
    const schedules = await storage.getAllSchedules(startDate ? new Date(startDate as string) : undefined, endDate ? new Date(endDate as string) : undefined);
    res.json(schedules);
  });

  app.patch("/api/schedules/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });

    try {
      const updates = { ...req.body };
      if (updates.date) updates.date = new Date(updates.date);
      if (updates.startTime) updates.startTime = new Date(updates.startTime);
      if (updates.endTime) updates.endTime = new Date(updates.endTime);

      const schedule = await storage.updateSchedule(req.params.id, updates);
      if (!schedule) return res.status(404).json({ message: "Schedule not found" });
      res.json(schedule);
    } catch (error: any) {
      console.error("Update schedule error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/schedules/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    try {
      const success = await storage.deleteSchedule(req.params.id);
      if (!success) return res.status(404).json({ message: "Schedule not found" });
      res.json({ message: "Schedule deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: "Failed to delete schedule" });
    }
  });

  app.post("/api/schedules/copy-week", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });
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

  // --- Announcements ---
  app.get("/api/announcements", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const announcements = await storage.getAllAnnouncements(req.user!.department);
    res.json(announcements);
  });

  app.post("/api/announcements", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'hr' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    try {
      const announcementData = insertAnnouncementSchema.parse({ ...req.body, authorId: user.id });
      const announcement = await storage.createAnnouncement(announcementData);
      res.json(announcement);
    } catch (error) {
      res.status(400).json({ message: "Invalid announcement data" });
    }
  });

  app.patch("/api/announcements/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (!["manager", "hr", "admin"].includes(user.role)) return res.status(403).json({ message: "Access denied" });
    try {
      const updateData = insertAnnouncementSchema.partial().parse(req.body);
      const updated = await storage.updateAnnouncement(req.params.id, updateData);
      if (!updated) return res.status(404).json({ message: "Announcement not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  // --- Reports & Analytics ---
  app.get("/api/dashboard-stats", async (req, res) => {
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

  app.get("/api/team", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'payroll_officer') return res.status(403).json({ message: "Access denied" });
    let teamMembers;
    if (user.role === 'admin' || user.role === 'payroll_officer') teamMembers = await storage.getAllUsers();
    else teamMembers = await storage.getEmployeesForManager(user.id);
    res.json(teamMembers);
  });

  // --- Attendance Overrides ---
  app.post("/api/attendance/clock-in", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not authenticated");
    const user = req.user as any;
    const clockInTime = req.body.date ? new Date(req.body.date) : new Date();
    // FIX: No getDayRange call yet

    try {
      // 1. Check for ANY active session (clocked in, not out)
      const activeSession = await db.query.attendance.findFirst({
        where: and(eq(attendance.userId, user.id), isNull(attendance.timeOut))
      });

      if (activeSession) {
        return res.status(400).json({ message: "You are already clocked in." });
      }

      const { notes } = req.body;
      
      // FIX: Pass Date object to insert
      const newRecord = await db.insert(attendance).values({
        userId: user.id,
        date: clockInTime, // Date object
        timeIn: clockInTime, // Date object
        status: "clocked_in",
        notes: notes,
        totalBreakMinutes: 0,
        totalWorkMinutes: 0
      }).returning();

      await db.insert(activities).values({
        userId: user.id,
        type: "clock_in",
        entityType: "attendance",
        entityId: newRecord[0].id,
        details: { action: "clock_in", userName: `${user.firstName} ${user.lastName}` }
      });
      res.json(newRecord[0]);
    } catch (error) {
      console.error("Clock in error:", error);
      res.status(500).json({ message: "Failed to clock in" });
    }
  });

  app.post("/api/attendance/clock-out", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not authenticated");
    const user = req.user as any;
    const clockOutTime = new Date(); 

    try {
      // Find ACTIVE session
      const currentAttendance = await db.query.attendance.findFirst({
        where: and(eq(attendance.userId, user.id), isNull(attendance.timeOut))
      });

      if (!currentAttendance) return res.status(400).json({ message: "No active clock-in found." });

      // Check for active breaks
      const activeBreak = await db.query.breaks.findFirst({
        where: and(eq(breaks.attendanceId, currentAttendance.id), isNull(breaks.breakEnd))
      });
      if (activeBreak) return res.status(400).json({ message: "Please end your break before clocking out" });

      const durationMs = clockOutTime.getTime() - Number(currentAttendance.timeIn);
      const workMinutes = Math.floor(durationMs / 60000) - (currentAttendance.totalBreakMinutes || 0);

      const updated = await db.update(attendance)
        .set({ 
            timeOut: clockOutTime, // Date object
            status: "clocked_out", 
            totalWorkMinutes: workMinutes > 0 ? workMinutes : 0 
        })
        .where(eq(attendance.id, currentAttendance.id))
        .returning();

      await db.insert(activities).values({
        userId: user.id,
        type: "clock_out",
        entityType: "attendance",
        entityId: currentAttendance.id,
        details: { action: "clock_out", userName: `${user.firstName} ${user.lastName}` }
      });
      res.json(updated[0]);
    } catch (error) {
      console.error("Clock out error:", error);
      res.status(500).json({ message: "Failed to clock out" });
    }
  });

  app.post("/api/attendance/break-start", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not authenticated");
    const user = req.user as any;
    const breakStartTime = new Date();

    try {
      // Find ACTIVE session
      const currentAttendance = await db.query.attendance.findFirst({
        where: and(eq(attendance.userId, user.id), isNull(attendance.timeOut))
      });
      
      if (!currentAttendance) return res.status(400).json({ message: "Must be clocked in to take a break" });

      const activeBreak = await db.query.breaks.findFirst({
        where: and(eq(breaks.attendanceId, currentAttendance.id), isNull(breaks.breakEnd))
      });
      if (activeBreak) return res.status(400).json({ message: "Already on break" });

      const { breakType, notes } = req.body;
      
      // FIX: Pass Date objects for timestamps
      const newBreak = await db.insert(breaks).values({
        attendanceId: currentAttendance.id,
        userId: user.id,
        breakStart: breakStartTime,
        breakType: breakType || "regular",
        notes: notes
      }).returning();

      await db.update(attendance).set({ status: "on_break" }).where(eq(attendance.id, currentAttendance.id));

      await db.insert(activities).values({
        userId: user.id,
        type: "break_start",
        entityType: "break",
        entityId: newBreak[0].id,
        details: { action: "break_start", breakType: breakType || 'regular', userName: `${user.firstName} ${user.lastName}` }
      });
      res.json(newBreak[0]);
    } catch (error) {
      console.error("Break start error:", error);
      res.status(500).json({ message: "Failed to start break" });
    }
  });

  app.post("/api/attendance/break-end", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not authenticated");
    const user = req.user as any;
    const breakEndTime = new Date();

    try {
      // Find ACTIVE break
      const activeBreak = await db.query.breaks.findFirst({
        where: and(eq(breaks.userId, user.id), isNull(breaks.breakEnd))
      });
      if (!activeBreak) return res.status(400).json({ message: "No active break found" });

      const breakDuration = Math.floor((breakEndTime.getTime() - Number(activeBreak.breakStart)) / 60000);

      const updatedBreak = await db.update(breaks)
        .set({ breakEnd: breakEndTime, breakMinutes: breakDuration }) // Pass Date object
        .where(eq(breaks.id, activeBreak.id))
        .returning();

      const att = await db.query.attendance.findFirst({ where: eq(attendance.id, activeBreak.attendanceId) });
      if (att) {
        await db.update(attendance)
          .set({ status: "clocked_in", totalBreakMinutes: (att.totalBreakMinutes || 0) + breakDuration })
          .where(eq(attendance.id, att.id));
      }

      await db.insert(activities).values({
        userId: user.id,
        type: "break_end",
        entityType: "break",
        entityId: activeBreak.id,
        details: { action: "break_end", userName: `${user.firstName} ${user.lastName}` }
      });
      res.json(updatedBreak[0]);
    } catch (error) {
      console.error("Break end error:", error);
      res.status(500).json({ message: "Failed to end break" });
    }
  });

  app.get("/api/attendance/today", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not authenticated");
    const user = req.user as any;
    const today = new Date();
    const { start, end } = getDayRange(today);

    try {
      // 1. Check for ACTIVE session first (Overnight support)
      let todayAttendance = await db.query.attendance.findFirst({
        where: and(eq(attendance.userId, user.id), isNull(attendance.timeOut))
      });

      // 2. If no active session, check for completed session TODAY
      if (!todayAttendance) {
          todayAttendance = await db.query.attendance.findFirst({
            where: and(eq(attendance.userId, user.id), gte(attendance.date, start), lte(attendance.date, end)),
            orderBy: [desc(attendance.timeIn)]
          });
      }

      let activeBreak = null;
      let breaksList = [];

      if (todayAttendance) {
        breaksList = await db.query.breaks.findMany({ where: eq(breaks.attendanceId, todayAttendance.id) });
        activeBreak = breaksList.find(b => !b.breakEnd) || null;
      }

      res.json({ attendance: todayAttendance || null, activeBreak: activeBreak, breaks: breaksList });
    } catch (error) {
      console.error("Get today attendance error:", error);
      res.status(500).json({ message: "Failed to get attendance" });
    }
  });

  // Get All Attendance (Filtered by Date)
  app.get("/api/attendance/all", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not authenticated");
    const user = req.user!;
    // Allow managers/admin/payroll
    if (user.role !== 'manager' && user.role !== 'payroll_officer' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });

    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const conditions = [];
      if (start) conditions.push(gte(attendance.date, start));
      if (end) conditions.push(lte(attendance.date, end));

      const attendanceRecords = await db.query.attendance.findMany({
         where: conditions.length > 0 ? and(...conditions) : undefined,
         orderBy: [desc(attendance.date)]
      });
      res.json(attendanceRecords);
    } catch (error) {
      console.error("Get all attendance error:", error);
      res.status(500).json({ message: "Failed to get attendance records" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}