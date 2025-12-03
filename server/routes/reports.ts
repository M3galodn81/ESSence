import { insertReportSchema, reports } from "@shared/schema";
import { Router } from "express";
import { db } from "server/db";
import { eq,desc} from "drizzle-orm";

const router = Router();


  // --- Reports & Analytics ---
  router.get("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    try {
      let result;
      // Admin & Manager see all (or you could filter by department)
      if (['admin', 'manager'].includes(user.role)) {
        result = await db.select().from(reports).orderBy(desc(reports.createdAt));
      } else {
        // Employees only see their own reports
        result = await db.select().from(reports).where(eq(reports.userId, user.id)).orderBy(desc(reports.createdAt));
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Create Report
  router.post("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const data = insertReportSchema.parse({
        ...req.body,
        userId: req.user!.id,
        // Ensure status is defaults
        status: "pending",
        createdAt: new Date(),
      });
      const report = await db.insert(reports).values(data).returning();
      res.json(report[0]);
    } catch (error) {
      res.status(400).json({ message: "Invalid report data" });
    }
  });

  // Resolve/Update Report
  router.patch("/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    
    // Only Managers/Admins can resolve
    if (!['admin', 'manager'].includes(user.role)) {
       return res.status(403).json({ message: "Access denied" });
    }

    try {
      const { status, resolutionNotes } = req.body;
      const updated = await db.update(reports)
        .set({ 
          status, 
          notes: resolutionNotes,
          resolvedBy: user.id,
          resolvedAt: status === 'resolved' ? new Date() : null
        })
        .where(eq(reports.id, req.params.id))
        .returning();
      
      res.json(updated[0]);
    } catch (error) {
      res.status(400).json({ message: "Failed to update report" });
    }
  });

export default router;