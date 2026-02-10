import { Router } from "express";
import { insertReportSchema, reports } from "@shared/schema";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod"; 
import { storage } from "server/storage";

const router = Router();

// --- Reports & Analytics ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  const user = req.user!;
  try {
    let result;
    // Managers/Admins see all, Employees see their own + assigned ones (handled in storage)
    if (['admin', 'manager'].includes(user.role)) {
      result = await storage.getAllReports();
    } else {
      result = await storage.getReportsByUser(user.id);
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
  
  try {
    // 1. Prepare Payload
    const payload = {
      ...req.body,
      userId: req.user!.id,
      // Ensure boolean conversion if sent as string from some clients, though zod handles it mostly
      nteRequired: req.body.nteRequired === true || req.body.nteRequired === 'true',
    };
    
    // 2. Validate
    const data = insertReportSchema.parse(payload);
    
    // 3. Fix Date Object for Drizzle
    const finalData = {
        ...data,
        dateOccurred: new Date(data.dateOccurred), 
        details: data.details || {},
        images: data.images || []
    };

    // 4. Insert
    const report = await db.insert(reports).values(finalData).returning();
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
  const reportId = req.params.id;

  try {
    // Fetch existing report to check permissions
    const existingReport = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
    if (!existingReport.length) return res.status(404).json({ message: "Report not found" });
    const report = existingReport[0];

    const { status, actionTaken, nteContent } = req.body;
    const updates: any = {};

    // Logic: 
    // 1. Admin/Manager can update status and actionTaken.
    // 2. Assigned Employee can update nteContent.
    
    const isManager = ['admin', 'manager'].includes(user.role);
    const isAssignedEmployee = user.id === report.assignedTo;

    if (isManager) {
        if (status) {
            updates.status = status;
            updates.resolvedBy = user.id;
            updates.resolvedAt = status === 'resolved' ? new Date() : null;
        }
        if (actionTaken) updates.actionTaken = actionTaken;
    }

    if (nteContent !== undefined && (isAssignedEmployee || isManager)) {
        updates.nteContent = nteContent;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid updates provided or permission denied" });
    }
    
    const updated = await db.update(reports)
      .set(updates)
      .where(eq(reports.id, reportId))
      .returning();
    
    res.json(updated[0]);
  } catch (error) {
    console.error("Update Report Error:", error);
    res.status(400).json({ message: "Failed to update report" });
  }
});

export default router;