import { Router } from "express";
import { insertReportSchema, reports } from "@shared/schema";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod"; 

const router = Router();

// --- Reports & Analytics ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  const user = req.user!;
  try {
    let result;
    // Admin & Manager see all
    if (['admin', 'manager'].includes(user.role)) {
      result = await db.select().from(reports).orderBy(desc(reports.createdAt));
    } else {
      // Employees only see their own reports
      result = await db.select().from(reports).where(eq(reports.userId, user.id)).orderBy(desc(reports.createdAt));
    }
    res.json(result);
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
});

// Create Report
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  
  console.log("📝 [POST /api/reports] Raw Body:", JSON.stringify(req.body, null, 2));

  try {
    // 1. Prepare Payload
    const payload = {
      ...req.body,
      userId: req.user!.id,
    };
    
    // 2. Validate
    const data = insertReportSchema.parse(payload);
    
    // 3. Fix Date Object for Drizzle
    // Drizzle's SQLite driver for 'timestamp_ms' expects a Date object, not a number/string.
    // Even if Zod returns a Date, we ensure it here to prevent 'getTime is not a function' errors.
    const finalData = {
        ...data,
        dateOccurred: new Date(data.dateOccurred), 
        // Ensure optional JSON fields are objects/arrays, not undefined/null
        details: data.details || {},
        images: data.images || []
    };

    console.log("🚀 [POST /api/reports] Inserting Data:", JSON.stringify(finalData, null, 2));

    // 4. Insert
    const report = await db.insert(reports).values(finalData).returning();
    
    console.log("✅ [POST /api/reports] Success:", report[0].id);
    res.json(report[0]);
  } catch (error) {
    console.error("❌ [POST /api/reports] Error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid report data", details: error.errors });
    }

    res.status(400).json({ message: "Invalid report data", details: String(error) });
  }
});

// Resolve/Update Report
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  const user = req.user!;
  
  if (!['admin', 'manager'].includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
  }

  try {
    const { status, resolutionNotes } = req.body;
    
    const updated = await db.update(reports)
      .set({ 
        status, 
        resolvedBy: user.id,
        resolvedAt: status === 'resolved' ? new Date() : null
      })
      .where(eq(reports.id, req.params.id))
      .returning();
    
    if (updated.length === 0) return res.status(404).json({ message: "Report not found" });

    res.json(updated[0]);
  } catch (error) {
    console.error("Update Report Error:", error);
    res.status(400).json({ message: "Failed to update report" });
  }
});

export default router;