import { Router } from "express";
import { insertReportSchema, reports } from "@shared/schema";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod"; 
import { storage } from "server/storage";
import { Permission, RolePermissions, Role } from "@/lib/permissions";

const router = Router();

// Backend helper to check permissions based on the shared RBAC config
const hasServerPermission = (role: string, permission: Permission) => {
  const userPermissions = RolePermissions[role as Role] || [];
  return userPermissions.includes(permission);
};

// --- Reports & Analytics ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }
  const user = req.user!;
  
  try {
    let result;
    
    if (hasServerPermission(user.role, Permission.VIEW_ALL_REPORTS)) {
      result = await storage.getAllReports();
    } else if (hasServerPermission(user.role, Permission.VIEW_OWN_REPORTS)) {
      result = await storage.getReportsByUser(user.id);
    } else {
      return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view reports." });
    }
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch reports" });
  }
});

// Create Report
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.SUBMIT_REPORT)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to submit reports." });
  }
  
  try {
    const payload = {
      ...req.body,
      userId: req.user!.id,
      nteRequired: req.body.nteRequired === true || req.body.nteRequired === 'true',
    };
    
    const data = insertReportSchema.parse(payload);
    
    const finalData = {
        ...data,
        dateOccurred: new Date(data.dateOccurred), 
        details: data.details || {},
        images: data.images || []
    };

    const report = await db.insert(reports).values(finalData).returning();
    res.status(201).json(report[0]);
  } catch (error) {
    console.error("❌ [POST /api/reports] Error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Bad Request", message: "Invalid report data", details: error.errors });
    }
    res.status(400).json({ error: "Bad Request", message: "Invalid report data", details: String(error) });
  }
});

// Resolve/Update Report
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }
  
  const user = req.user!;
  const reportId = req.params.id;

  try {
    const existingReport = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
    if (!existingReport.length) {
      return res.status(404).json({ error: "Not Found", message: "Report not found" });
    }
    
    const report = existingReport[0];
    const { status, actionTaken, nteContent } = req.body;
    const updates: any = {};

    const canManage = hasServerPermission(user.role, Permission.MANAGE_REPORTS);
    const isAssignedEmployee = user.id === report.assignedTo;

    // Admin/HR/Manager can update status and actionTaken.
    if (canManage) {
        if (status) {
            updates.status = status;
            updates.resolvedBy = user.id;
            updates.resolvedAt = status === 'resolved' ? new Date() : null;
        }
        if (actionTaken) updates.actionTaken = actionTaken;
    }

    // Assigned Employee or Manager can update nteContent.
    if (nteContent !== undefined && (isAssignedEmployee || canManage)) {
        updates.nteContent = nteContent;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(403).json({ error: "Forbidden", message: "No valid updates provided or permission denied." });
    }
    
    const updated = await db.update(reports)
      .set(updates)
      .where(eq(reports.id, reportId))
      .returning();
    
    res.json(updated[0]);
  } catch (error) {
    console.error("Update Report Error:", error);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to update report" });
  }
});

export default router;