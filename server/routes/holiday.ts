import { Router } from "express";
import { db } from "server/db";
import { holidays, insertHolidaySchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { Permission, RolePermissions, Role } from "@/lib/permissions";

const router = Router();

// Backend helper to check permissions based on the shared RBAC config
const hasServerPermission = (role: string, permission: Permission) => {
  const userPermissions = RolePermissions[role as Role] || [];
  return userPermissions.includes(permission);
};

// --- Get All Holidays ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.VIEW_HOLIDAYS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view holidays." });
  }

  try {
    const allHolidays = await db.select().from(holidays);
    res.json(allHolidays);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch holidays." });
  }
});

// --- Create Holidays ---
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_HOLIDAYS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to create holidays." });
  }
  
  try {
    const data = insertHolidaySchema.parse({
      ...req.body,
      date: new Date(req.body.date),
    });
    const holiday = await db.insert(holidays).values(data).returning();
    res.status(201).json(holiday[0]);
  } catch (error) {
    res.status(400).json({ error: "Bad Request", message: "Invalid holiday data provided." });
  }
});

// --- Delete Holiday ---
router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_HOLIDAYS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to delete holidays." });
  }
  
  try {
    const result = await db.delete(holidays).where(eq(holidays.id, req.params.id)).returning();
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Not Found", message: "Holiday not found." });
    }

    res.json({ message: "Holiday deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to delete holiday." });
  }
});

export default router;