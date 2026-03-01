import { insertScheduleApiSchema } from "@shared/schema";
import { Router } from "express";
import { storage } from "server/storage";
import { Permission, RolePermissions, Role } from "@/lib/permissions";

const router = Router();

// Backend helper to check permissions based on the shared RBAC config
const hasServerPermission = (role: string, permission: Permission) => {
  const userPermissions = RolePermissions[role as Role] || [];
  return userPermissions.includes(permission);
};

// --- View Own Schedules ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.VIEW_OWN_SCHEDULE)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view schedules." });
  }

  try {
    const { startDate, endDate } = req.query;
    const schedules = await storage.getSchedulesByUser(
      req.user!.id, 
      startDate ? new Date(startDate as string) : undefined, 
      endDate ? new Date(endDate as string) : undefined
    );
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch schedules." });
  }
});

// --- Create Schedule ---
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_SCHEDULES)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to manage schedules." });
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
    res.status(201).json(schedule);
  } catch (error: any) {
    console.error("Schedule validation error:", error);
    res.status(400).json({ error: "Bad Request", message: "Invalid schedule data", details: error.message });
  }
});

// --- Get All Schedules (for Managers/Admins) ---
router.get("/all", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.VIEW_ALL_SCHEDULES) && !hasServerPermission(req.user!.role, Permission.VIEW_TEAM_SCHEDULE)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view all schedules." });
  }

  try {
    const { startDate, endDate } = req.query;
    const schedules = await storage.getAllSchedules(
      startDate ? new Date(startDate as string) : undefined, 
      endDate ? new Date(endDate as string) : undefined
    );
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch schedules." });
  }
});

// --- Update Schedule ---
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_SCHEDULES)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to update schedules." });
  }

  try {
    const updates = { ...req.body };
    if (updates.date) updates.date = new Date(updates.date);
    if (updates.startTime) updates.startTime = new Date(updates.startTime);
    if (updates.endTime) updates.endTime = new Date(updates.endTime);

    const schedule = await storage.updateSchedule(req.params.id, updates);
    if (!schedule) {
      return res.status(404).json({ error: "Not Found", message: "Schedule not found" });
    }
    res.json(schedule);
  } catch (error: any) {
    console.error("Update schedule error:", error);
    res.status(400).json({ error: "Bad Request", message: error.message });
  }
});

// --- Delete Schedule ---
router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_SCHEDULES)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to delete schedules." });
  }

  try {
    const success = await storage.deleteSchedule(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Not Found", message: "Schedule not found" });
    }
    res.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to delete schedule" });
  }
});

// --- Copy Week Schedules ---
router.post("/copy-week", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_SCHEDULES)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to duplicate schedules." });
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
        shiftType: schedule.shiftType,
        shiftRole: schedule.shiftRole,
        location: schedule.location,
      });
      newSchedules.push(newSchedule);
    }
    res.json({ message: `Copied ${newSchedules.length} shifts`, schedules: newSchedules });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error", message: error.message || "Failed to copy schedule" });
  }
});

export default router;