import { Router } from "express";
import { db } from "server/db"; 
import { insertLaborCostDataSchema, laborCostData } from "@shared/schema";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import { Permission, RolePermissions, Role } from "@/lib/permissions";

const router = Router();

// Backend helper to check permissions based on the shared RBAC config
const hasServerPermission = (role: string, permission: Permission) => {
  const userPermissions = RolePermissions[role as Role] || [];
  return userPermissions.includes(permission);
};

// --- GET: Labor Cost Analytics ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in to view analytics." });
  }
  
  if (!hasServerPermission(req.user!.role, Permission.VIEW_LABOR_COST)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view labor cost analytics." });
  }

  try {
    const data = await db
      .select()
      .from(laborCostData)
      .orderBy(laborCostData.year, laborCostData.month);
      
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch analytics data." });
  }
});

// --- POST: Create ---
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in to create entries." });
  }
  
  if (!hasServerPermission(req.user!.role, Permission.MANAGE_LABOR_COST)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to create labor cost entries." });
  }

  try {
    const data = insertLaborCostDataSchema.parse(req.body);
    const result = await db.insert(laborCostData).values(data).returning();
    
    res.status(201).json(result[0]);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Bad Request", message: "Invalid data provided.", details: error.errors });
    }
    res.status(500).json({ error: "Internal Server Error", message: "Failed to create labor cost entry." });
  }
});

// --- PATCH: Edit ---
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in to edit entries." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_LABOR_COST)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to edit labor cost entries." });
  }

  const id = req.params.id;

  try {
    const data = insertLaborCostDataSchema.parse(req.body);

    const result = await db
      .update(laborCostData)
      .set(data)
      .where(eq(laborCostData.id, id))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: "Not Found", message: "Labor cost record not found." });
    }

    res.json(result[0]);
  } catch (error) {
    console.error(error);
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Bad Request", message: "Invalid data provided.", details: error.errors });
    }
    res.status(500).json({ error: "Internal Server Error", message: "Failed to update labor cost entry." });
  }
});

// --- DELETE: Delete ---
router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in to delete entries." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_LABOR_COST)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to delete labor cost entries." });
  }

  const id = req.params.id;

  try {
    const result = await db
      .delete(laborCostData)
      .where(eq(laborCostData.id, id))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: "Not Found", message: "Labor cost record not found." });
    }

    res.json({ message: "Record deleted successfully", deletedId: id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to delete labor cost entry." });
  }
});

export default router;