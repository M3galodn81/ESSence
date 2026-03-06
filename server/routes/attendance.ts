import { Router } from "express";
import { db } from "../db";
import { attendance, breaks, activities } from "@shared/schema";
import { eq, and, gte, lte, isNull, desc } from "drizzle-orm";
import { Permission, RolePermissions, Role } from "@/lib/permissions";

const router = Router();

const getDayRange = (dateObj: Date) => {
  const start = new Date(dateObj);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateObj);
  end.setHours(23, 59, 59, 999);
  return { start, end }; 
};

const hasServerPermission = (role: string, permission: Permission) => {
  const userPermissions = RolePermissions[role as Role] || [];
  return userPermissions.includes(permission);
};

// --- Helper to resolve target user for Manager Overrides ---
const getTargetUserId = (req: any) => {
  const user = req.user as any;
  const targetId = req.body.userId || user.id;
  
  if (targetId !== user.id && !hasServerPermission(user.role, Permission.MANAGE_ATTENDANCE)) {
    throw new Error("Forbidden: Cannot manage others' attendance");
  }
  return targetId;
};

// --- Clock In ---
router.post("/clock-in", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const targetUserId = getTargetUserId(req);
    const clockInTime = req.body.date ? new Date(req.body.date) : new Date();

    const activeSession = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, targetUserId), isNull(attendance.timeOut))
    });

    if (activeSession) return res.status(400).json({ error: "Bad Request", message: "Employee is already clocked in." });
    
    const newRecord = await db.insert(attendance).values({
      userId: targetUserId,
      date: clockInTime,
      timeIn: clockInTime,
      status: "clocked_in",
      notes: req.body.notes || (req.body.userId ? "Clocked in manually by Manager" : null),
      totalBreakMinutes: 0,
      totalWorkMinutes: 0
    }).returning();
    
    // FIX: Send a string instead of an object to the details text field to prevent 500 error
    await db.insert(activities).values({
      userId: targetUserId,
      type: "clock_in",
      entityType: "attendance",
      entityId: String(newRecord[0].id), 
      details: req.body.userId ? `Manually clocked in by Manager (ID: ${(req.user as any).id})` : `Clocked in normally`,
    });
    
    res.json(newRecord[0]);
  } catch (error: any) {
    if (error.message.includes("Forbidden")) return res.status(403).json({ error: "Forbidden", message: error.message });
    console.error("Clock In Error:", error);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to clock in" });
  }
});

// --- Clock Out ---
router.post("/clock-out", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });

  try {
    const targetUserId = getTargetUserId(req);
    const clockOutTime = new Date(); 

    const currentAttendance = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, targetUserId), isNull(attendance.timeOut))
    });

    if (!currentAttendance) return res.status(400).json({ error: "Bad Request", message: "No active clock-in found." });

    const activeBreak = await db.query.breaks.findFirst({
      where: and(eq(breaks.attendanceId, currentAttendance.id), isNull(breaks.breakEnd))
    });
    
    if (activeBreak) return res.status(400).json({ error: "Bad Request", message: "Please end the break before clocking out." });

    // FIX: Safely calculate duration using new Date() wrapper
    const durationMs = clockOutTime.getTime() - new Date(currentAttendance.timeIn).getTime();
    const workMinutes = Math.floor(durationMs / 60000) - (currentAttendance.totalBreakMinutes || 0);

    const updated = await db.update(attendance)
      .set({ timeOut: clockOutTime, status: "clocked_out", totalWorkMinutes: workMinutes > 0 ? workMinutes : 0 })
      .where(eq(attendance.id, currentAttendance.id))
      .returning();

    // FIX: Send string instead of object
    await db.insert(activities).values({
      userId: targetUserId,
      type: "clock_out",
      entityType: "attendance",
      entityId: String(currentAttendance.id),
      details: req.body.userId ? `Manually clocked out by Manager (ID: ${(req.user as any).id})` : `Clocked out normally`,
    });
    
    res.json(updated[0]);
  } catch (error: any) {
    if (error.message.includes("Forbidden")) return res.status(403).json({ error: "Forbidden", message: error.message });
    console.error("Clock Out Error:", error);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to clock out" });
  }
});

// --- Break Start ---
router.post("/break-start", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });

  try {
    const targetUserId = getTargetUserId(req);
    const breakStartTime = new Date();

    const currentAttendance = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, targetUserId), isNull(attendance.timeOut))
    });
    
    if (!currentAttendance) return res.status(400).json({ error: "Bad Request", message: "Must be clocked in to take a break" });

    const activeBreak = await db.query.breaks.findFirst({
      where: and(eq(breaks.attendanceId, currentAttendance.id), isNull(breaks.breakEnd))
    });
    
    if (activeBreak) return res.status(400).json({ error: "Bad Request", message: "Already on break" });

    const newBreak = await db.insert(breaks).values({
      attendanceId: currentAttendance.id,
      userId: targetUserId,
      breakStart: breakStartTime,
      breakType: req.body.breakType || "regular",
      notes: req.body.notes || (req.body.userId ? "Break started manually by Manager" : null)
    }).returning();

    await db.update(attendance).set({ status: "on_break" }).where(eq(attendance.id, currentAttendance.id));
    
    // FIX: Log activities as strings
    await db.insert(activities).values({
      userId: targetUserId,
      type: "break_start",
      entityType: "break",
      entityId: String(newBreak[0].id),
      details: req.body.userId ? `Break started by Manager` : `Break started normally`,
    });

    res.json(newBreak[0]);
  } catch (error: any) {
    if (error.message.includes("Forbidden")) return res.status(403).json({ error: "Forbidden", message: error.message });
    console.error("Break Start Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Break End ---
router.post("/break-end", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });

  try {
    const targetUserId = getTargetUserId(req);
    const breakEndTime = new Date();

    const activeBreak = await db.query.breaks.findFirst({
      where: and(eq(breaks.userId, targetUserId), isNull(breaks.breakEnd))
    });
    
    if (!activeBreak) return res.status(400).json({ error: "Bad Request", message: "No active break found" });

    const breakDuration = Math.floor((breakEndTime.getTime() - new Date(activeBreak.breakStart!).getTime()) / 60000);

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
    
    // FIX: Log activities as strings
    await db.insert(activities).values({
      userId: targetUserId,
      type: "break_end",
      entityType: "break",
      entityId: String(activeBreak.id),
      details: req.body.userId ? `Break ended by Manager` : `Break ended normally`,
    });

    res.json(updatedBreak[0]);
  } catch (error: any) {
    if (error.message.includes("Forbidden")) return res.status(403).json({ error: "Forbidden", message: error.message });
    console.error("Break End Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Get Manager View: Specific Employee Today ---
router.get("/user-today/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const user = req.user as any;
  
  if (!hasServerPermission(user.role, Permission.MANAGE_ATTENDANCE)) {
    return res.status(403).json({ error: "Forbidden", message: "Manager access required." });
  }

  const targetUserId = req.params.id;
  const today = new Date();
  const { start, end } = getDayRange(today);

  try {
    let todayAttendance = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, targetUserId), isNull(attendance.timeOut))
    });

    if (!todayAttendance) {
        todayAttendance = await db.query.attendance.findFirst({
          where: and(eq(attendance.userId, targetUserId), gte(attendance.date, start), lte(attendance.date, end)),
          orderBy: [desc(attendance.timeIn)]
        });
    }

    let activeBreak = null;
    let breaksList = [];

    if (todayAttendance) {
      breaksList = await db.query.breaks.findMany({ where: eq(breaks.attendanceId, todayAttendance.id) });
      activeBreak = breaksList.find(b => !b.breakEnd) || null;
    }

    res.json({ attendance: todayAttendance || null, activeBreak, breaks: breaksList });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Get Today's Attendance (Self) ---
router.get("/today", async (req, res) => { 
  const user = req.user as any;
  const { start, end } = getDayRange(new Date());

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
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Get Own Attendance History ---
router.get("/", async (req, res) => { 
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
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
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Get All Attendance (for Managers/Admin/Payroll) ---
router.get("/all", async (req, res) => { 
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  const user = req.user!;

  if (!hasServerPermission(user.role, Permission.VIEW_ALL_ATTENDANCE) && !hasServerPermission(user.role, Permission.VIEW_TEAM_ATTENDANCE)) {
    return res.status(403).json({ error: "Forbidden", message: "Access denied." });
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
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;