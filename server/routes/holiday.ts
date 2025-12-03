import { Router } from "express";
import { storage } from "../storage";
import { hashPassword } from "../auth";
import { db } from "server/db";
import { holidays, insertHolidaySchema } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();
// --- Get All Holidays ---
  router.get("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const allHolidays = await db.select().from(holidays);
    res.json(allHolidays);
  });

  // --- Create / Delete Holidays ---
  router.post("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user!.role !== 'payroll_officer' && req.user!.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    
    try {
      const data = insertHolidaySchema.parse({
        ...req.body,
        date: new Date(req.body.date),
      });
      const holiday = await db.insert(holidays).values(data).returning();
      res.json(holiday[0]);
    } catch (error) {
      res.status(400).json({ message: "Invalid holiday data" });
    }
  });

  // --- Delete Holiday ---
  router.delete("/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
     if (req.user!.role !== 'payroll_officer' && req.user!.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    
    await db.delete(holidays).where(eq(holidays.id, req.params.id));
    res.json({ message: "Holiday deleted" });
  });

export default router;