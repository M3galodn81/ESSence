import { Router } from "express";
import { db } from "../db";
import { attendance, breaks, activities } from "@shared/schema";
import { eq, and, gte, lte, isNull, desc } from "drizzle-orm";

// Helper: Get Start/End of a specific date for Attendance queries
const getDayRange = (dateObj: Date) => {
const start = new Date(dateObj);
start.setHours(0, 0, 0, 0);
const end = new Date(dateObj);
end.setHours(23, 59, 59, 999);
return { start, end }; 
};


const router = Router();

  // --- Clock In---
  router.post("/clock-in", async (req, res) => {
    // Authentication check
    if (!req.isAuthenticated()) return res.status(401).send("Not authenticated");
    const user = req.user as any;
    
    // Use provided date or current time
    const clockInTime = req.body.date ? new Date(req.body.date) : new Date();

    try {
      // Check for existing ACTIVE session
      const activeSession = await db.query.attendance.findFirst({
        where: and(eq(attendance.userId, user.id), isNull(attendance.timeOut))
      });

      // If active session exists, prevent clock-in
      if (activeSession) {
        return res.status(400).json({ message: "You are already clocked in." });
      } 
      
      // Create new attendance record
      const { notes } = req.body;
      const newRecord = await db.insert(attendance).values({
        userId: user.id,
        date: clockInTime,
        timeIn: clockInTime,
        status: "clocked_in",
        notes: notes,
        totalBreakMinutes: 0,
        totalWorkMinutes: 0
      }).returning();
      
      // Log activity
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

  // --- Clock Out ---
  router.post("/clock-out", async (req, res) => {
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

      // Calculate total work minutes
      const durationMs = clockOutTime.getTime() - Number(currentAttendance.timeIn);
      const workMinutes = Math.floor(durationMs / 60000) - (currentAttendance.totalBreakMinutes || 0);

      // Update attendance record
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

  // --- Break Start ---
  router.post("/break-start", async (req, res) => {
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
      
      // Create new break record
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

  //  --- Break End ---
  router.post("/break-end", async (req, res) => {
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

  // --- Get Today's Attendance ---
  router.get("/today", async (req, res) => {
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
  // --- Get Attendance History ---
  router.get("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const conditions = [eq(attendance.userId, user.id)];
      if (start) conditions.push(gte(attendance.date, start));
      if (end) conditions.push(lte(attendance.date, end));

      const records = await db.query.attendance.findMany({
        where: and(...conditions),
        orderBy: [desc(attendance.date)]
      });
      res.json(records);
    } catch (error) {
      console.error("Get attendance history error:", error);
      res.status(500).json({ message: "Failed to fetch attendance records" });
    }
  });

  // --- Get All Attendance (for Managers/Admin/Payroll) ---
  router.get("/all", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Not authenticated");
    const user = req.user!;
   
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

  // Get All Attendance (Filtered by Date)
  router.get("/all", async (req, res) => {
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

export default router;