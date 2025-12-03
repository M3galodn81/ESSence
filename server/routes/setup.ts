import { Router } from "express";
import { storage } from "../storage";
import { hashPassword } from "../auth";

const router = Router();

// --- Setup Check---
  router.get("/check", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const hasAdmin = users && users.length > 0 && users.some(u => u.role === "admin");
      res.json({ needsSetup: !hasAdmin });
    } catch (error) {
      console.error("Setup check error:", error);
      res.json({ needsSetup: true });
    }
  });

  // --- Make admin account---
  router.post("/admin", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const hasAdmin = users.some(u => u.role === "admin");
      if (hasAdmin) return res.status(400).send("Admin account already exists");

      const adminData = {
        ...req.body,
        password: await hashPassword(req.body.password),
        role: "admin",
        department: "Administration",
        position: "System Administrator",
      };
      const admin = await storage.createUser(adminData);
      res.json(admin);
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to create admin account");
    }
  });

export default router;