import { Router } from "express";
import { storage } from "../storage";
import { db } from "server/db";
import { payslips } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { Permission, RolePermissions, Role } from "@/lib/permissions";

const router = Router();

// Backend helper to check permissions based on the shared RBAC config
const hasServerPermission = (role: string, permission: Permission) => {
  const userPermissions = RolePermissions[role as Role] || [];
  return userPermissions.includes(permission);
};

// --- Payslips Routes ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }
  const user = req.user!;
  
  // Admin/Payroll Officer: Fetch All
  if (req.query.all === 'true' && hasServerPermission(user.role, Permission.VIEW_ALL_PAYSLIPS)) {
      try {
          const all = await db.query.payslips.findMany();
          return res.json(all);
      } catch (e) {
          console.error("Fetch all payslips error:", e);
          return res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch all payslips" });
      }
  }

  // Manager: Fetch Team + Self (Specific Business Logic)
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
          return res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch team payslips" });
      }
  }

  // Default: By User
  if (!hasServerPermission(user.role, Permission.VIEW_OWN_PAYSLIP)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view payslips." });
  }

  try {
    const result = await storage.getPayslipsByUser(user.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch your payslips." });
  }
});

// --- Create Payslip ---
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_PAYROLL)) {
      return res.status(403).json({ error: "Forbidden", message: "You do not have permission to create payslips." });
  }

  try {
    const payslip = await storage.createPayslip(req.body);
    res.status(201).json(payslip);
  } catch (error: any) {
    res.status(400).json({ error: "Bad Request", message: error.message || "Failed to create payslip" });
  }
});

// --- Edit Payslip ---
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_PAYROLL)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to edit payslips." });
  }

  try {
    const updated = await db.update(payslips)
      .set(req.body)
      .where(eq(payslips.id, req.params.id))
      .returning();
    
    if (!updated.length) {
      return res.status(404).json({ error: "Not Found", message: "Payslip not found" });
    }
    res.json(updated[0]);
  } catch (error: any) {
    res.status(400).json({ error: "Bad Request", message: error.message });
  }
});

// --- Delete Payslip ---
router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_PAYROLL)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to delete payslips." });
  }

  try {
    const deleted = await db.delete(payslips)
      .where(eq(payslips.id, req.params.id))
      .returning();
    
    if (!deleted.length) {
      return res.status(404).json({ error: "Not Found", message: "Payslip not found" });
    }
    res.json(deleted[0]);
  } catch (error: any) {
    res.status(400).json({ error: "Bad Request", message: error.message });
  }
});

export default router;