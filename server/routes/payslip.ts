import { Router } from "express";
import { storage } from "../storage";
import { db } from "server/db";
import { payslips } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";


const router = Router();

  // --- Payslips Routes ---
  router.get("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    
    // Admin/Payroll Officer: Fetch All
    if (req.query.all === 'true' && (user.role === 'payroll_officer' || user.role === 'admin')) {
        try {
            const all = await db.query.payslips.findMany();
            return res.json(all);
        } catch (e) {
            console.error("Fetch all payslips error:", e);
            return res.status(500).json({ message: "Failed to fetch all payslips" });
        }
    }

    // Manager: Fetch Team + Self
    if (req.query.all === 'true' && user.role === 'manager') {
        try {
            const team = await storage.getEmployeesForManager(user.id);
            const ids = team.map(u => u.id);
            ids.push(user.id); 
            
            const teamPayslips = await db.query.payslips.findMany({
                where: inArray(payslips.userId, ids)
            });
            return res.json(teamPayslips);
        } catch (e) {
            console.error("Fetch manager payslips error:", e);
            return res.status(500).json({ message: "Failed to fetch team payslips" });
        }
    }

    // Default: By User
    const result = await storage.getPayslipsByUser(user.id);
    res.json(result);
  });

  // --- Create Payslip ---
  router.post("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user!.role !== 'payroll_officer' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
    }
    try {
      const payslip = await storage.createPayslip(req.body);
      res.json(payslip);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create payslip" });
    }
  });

  // --- Edit Payslip ---
  router.patch("/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'payroll_officer' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });

    try {
      const updated = await db.update(payslips)
        .set(req.body)
        .where(eq(payslips.id, req.params.id))
        .returning();
      
      if (!updated.length) return res.status(404).json({ message: "Payslip not found" });
      res.json(updated[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // --- Delete Payslip ---
  router.delete("/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'payroll_officer' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });

    try {
      const deleted = await db.delete(payslips)
        .where(eq(payslips.id, req.params.id))
        .returning();
      
      if (!deleted.length) return res.status(404).json({ message: "Payslip not found" });
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

export default router;