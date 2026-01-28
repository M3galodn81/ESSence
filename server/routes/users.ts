import { Router } from "express";
import { storage } from "../storage";
import { hashPassword } from "../auth";

const router = Router();

// --- Get all users ---
  router.get("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'manager') return res.status(403).json({ message: "Access denied" });
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // --- Make users ---
  router.post("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    const requestedRole = req.body.role;

    if (user.role === 'manager' && requestedRole !== 'employee') return res.status(403).send("Managers can only create employee accounts");
    if (user.role !== 'admin' && user.role !== 'manager') return res.status(403).send("Access denied");

    try {
      const userData = { ...req.body, password: await hashPassword(req.body.password) };
      if (user.role === 'manager' && requestedRole === 'employee' && !userData.managerId) userData.managerId = user.id;
      if (requestedRole === 'manager') {
        if (!userData.managerId || userData.managerId === '') delete userData.managerId;
        else {
          const managerExists = await storage.getUser(userData.managerId);
          if (!managerExists) return res.status(400).send("Invalid manager ID provided");
        }
      }
      const newUser = await storage.createUser(userData, user.id);
      res.json(newUser);
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to create user");
    }
  });

  // --- Edit users ---
  router.patch("/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user!.role !== 'admin') return res.status(403).send("Only admins can edit users");
    try {
      const updatedUser = await storage.updateUser(req.params.id, req.body);
      if (!updatedUser) return res.status(404).send("User not found");
      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to update user");
    }
  });

  // --- Change password ---
  router.patch("/:id/password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user!.role !== 'admin') return res.status(403).send("Only admins can change passwords");
    try {
      const hashedPassword = await hashPassword(req.body.password);
      const updatedUser = await storage.updateUser(req.params.id, { password: hashedPassword });
      if (!updatedUser) return res.status(404).send("User not found");
      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to change password");
    }
  });

  // --- Delete users ---
  router.delete("/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'admin') return res.status(403).send("Only admins can delete users");
    if (user.id === req.params.id) return res.status(400).send("You cannot delete your own account");
    try {
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      res.status(400).send(error.message || "Failed to delete user");
    }
  });

  export default router;