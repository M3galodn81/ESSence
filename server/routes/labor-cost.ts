import { Router } from "express";
import { storage } from "../storage"; // Assuming this handles other logic if needed
import { db } from "server/db"; // Ensure this path matches your project aliases
import { insertLaborCostDataSchema, laborCostData } from "@shared/schema";
import { ZodError } from "zod";
import { eq } from "drizzle-orm"; // ✅ Fixed: Clean import of 'eq'
import { canViewLaborCostAnalysis } from "@/utils/permissions";

const router = Router();

// --- GET: Labor Cost Analytics ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  const user = req.user!;
  
  if (!['admin', 'manager', 'payroll_officer'].includes(user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const data = await db
      .select()
      .from(laborCostData)
      .orderBy(laborCostData.year, laborCostData.month);
      
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

// --- POST: Create ---
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  
  const user = req.user!;
  if (!['admin', 'manager', 'payroll_officer'].includes(user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const data = insertLaborCostDataSchema.parse(req.body);
    const result = await db.insert(laborCostData).values(data).returning();
    
    res.status(201).json(result[0]);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create labor cost entry" });
  }
});

// --- PUT: Edit ---
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  const user = req.user!;
  if (!canViewLaborCostAnalysis(user)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const id = req.params.id; // UUID string

  try {
    const data = insertLaborCostDataSchema.parse(req.body);

    const result = await db
      .update(laborCostData)
      .set(data)
      .where(eq(laborCostData.id, id))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.json(result[0]);
  } catch (error) {
     console.error(error);
    if (error instanceof ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update labor cost entry" });
  }
});

// --- DELETE: Delete ---
router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  const user = req.user!;
  if (!canViewLaborCostAnalysis(user)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const id = req.params.id; // UUID string

  try {
    const result = await db
      .delete(laborCostData)
      .where(eq(laborCostData.id, id))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.json({ message: "Record deleted successfully", deletedId: id });
  } catch (error) {
     console.error(error);
    res.status(500).json({ message: "Failed to delete labor cost entry" });
  }
});


export default router;