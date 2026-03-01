import { Router } from "express";
import { db } from "../db";
import { attendance, breaks, activities } from "@shared/schema";
import { eq, and, gte, lte, isNull, desc } from "drizzle-orm";
import { Permission, RolePermissions, Role } from "@/lib/permissions";

const router = Router();

// Helper: Get Start/End of a specific date for Attendance queries
const getDayRange = (dateObj: Date) => {
  const start = new Date(dateObj);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateObj);
  end.setHours(23, 59, 59, 999);
  return { start, end }; 
};

// Backend helper to check permissions based on the shared RBAC config
const hasServerPermission = (role: string, permission: Permission) => {
  const userPermissions = RolePermissions[role as Role] || [];
  return userPermissions.includes(permission);
};

// --- Clock In---
router.post("/clock-in", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
  }
  const user = req.user as any;

  if (!hasServerPermission(user.role, Permission.SUBMIT_ATTENDANCE)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to clock in." });
  }
  
  const clockInTime = req.body.date ? new Date(req.body.date) : new Date();

  try {
    const activeSession = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, user.id), isNull(attendance.timeOut))
    });

    if (activeSession) {
      return res.status(400).json({ error: "Bad Request", message: "You are already clocked in." });
    } 
    
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
    res.status(500).json({ error: "Internal Server Error", message: "Failed to clock in" });
  }
});

// --- Clock Out ---
router.post("/clock-out", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
  }
  const user = req.user as any;

  if (!hasServerPermission(user.role, Permission.SUBMIT_ATTENDANCE)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to clock out." });
  }

  const clockOutTime = new Date(); 

  try {
    const currentAttendance = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, user.id), isNull(attendance.timeOut))
    });

    if (!currentAttendance) {
      return res.status(400).json({ error: "Bad Request", message: "No active clock-in found." });
    }

    const activeBreak = await db.query.breaks.findFirst({
      where: and(eq(breaks.attendanceId, currentAttendance.id), isNull(breaks.breakEnd))
    });
    
    if (activeBreak) {
      return res.status(400).json({ error: "Bad Request", message: "Please end your break before clocking out" });
    }

    const durationMs = clockOutTime.getTime() - Number(currentAttendance.timeIn);
    const workMinutes = Math.floor(durationMs / 60000) - (currentAttendance.totalBreakMinutes || 0);

    const updated = await db.update(attendance)
      .set({ 
          timeOut: clockOutTime,
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
    res.status(500).json({ error: "Internal Server Error", message: "Failed to clock out" });
  }
});

// --- Break Start ---
router.post("/break-start", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
  }
  const user = req.user as any;

  if (!hasServerPermission(user.role, Permission.SUBMIT_ATTENDANCE)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to log breaks." });
  }

  const breakStartTime = new Date();

  try {
    const currentAttendance = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, user.id), isNull(attendance.timeOut))
    });
    
    if (!currentAttendance) {
      return res.status(400).json({ error: "Bad Request", message: "Must be clocked in to take a break" });
    }

    const activeBreak = await db.query.breaks.findFirst({
      where: and(eq(breaks.attendanceId, currentAttendance.id), isNull(breaks.breakEnd))
    });
    
    if (activeBreak) {
      return res.status(400).json({ error: "Bad Request", message: "Already on break" });
    }

    const { breakType, notes } = req.body;
    
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
    res.status(500).json({ error: "Internal Server Error", message: "Failed to start break" });
  }
});

// --- Break End ---
router.post("/break-end", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
  }
  const user = req.user as any;

  if (!hasServerPermission(user.role, Permission.SUBMIT_ATTENDANCE)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to log breaks." });
  }

  const breakEndTime = new Date();

  try {
    const activeBreak = await db.query.breaks.findFirst({
      where: and(eq(breaks.userId, user.id), isNull(breaks.breakEnd))
    });
    
    if (!activeBreak) {
      return res.status(400).json({ error: "Bad Request", message: "No active break found" });
    }

    const breakDuration = Math.floor((breakEndTime.getTime() - Number(activeBreak.breakStart)) / 60000);

    const updatedBreak = await db.update(breaks)
      .set({ breakEnd: breakEndTime, breakMinutes: breakDuration })
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
    res.status(500).json({ error: "Internal Server Error", message: "Failed to end break" });
  }
});

// --- Get Today's Attendance ---
router.get("/today", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
  }
  const user = req.user as any;

  if (!hasServerPermission(user.role, Permission.VIEW_OWN_ATTENDANCE)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view attendance." });
  }

  const today = new Date();
  const { start, end } = getDayRange(today);

  try {
    let todayAttendance = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, user.id), isNull(attendance.timeOut))
    });

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
    res.status(500).json({ error: "Internal Server Error", message: "Failed to get attendance" });
  }
});

// --- Get Own Attendance History ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
  }
  const user = req.user!;

  if (!hasServerPermission(user.role, Permission.VIEW_OWN_ATTENDANCE)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view attendance records." });
  }
  
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
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch attendance records" });
  }
});

// --- Get All Attendance (for Managers/Admin/Payroll) ---
router.get("/all", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
  }
  const user = req.user!;

  // Allow if user has VIEW_ALL_ATTENDANCE or VIEW_TEAM_ATTENDANCE
  if (!hasServerPermission(user.role, Permission.VIEW_ALL_ATTENDANCE) && !hasServerPermission(user.role, Permission.VIEW_TEAM_ATTENDANCE)) {
    return res.status(403).json({ error: "Forbidden", message: "Access denied. You do not have permission to view company attendance records." });
  }
 
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
    res.status(500).json({ error: "Internal Server Error", message: "Failed to get attendance records" });
  }
});

export default router;