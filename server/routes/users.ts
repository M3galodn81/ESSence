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
    
    // FIX: Convert timestamps to Date objects for Drizzle
    if (userData.birthDate) userData.birthDate = new Date(userData.birthDate);
    if (userData.hireDate) userData.hireDate = new Date(userData.hireDate);

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

router.patch("/profile", async (req, res) => {
  // 1. Ensure user is logged in
  if (!req.isAuthenticated()) return res.sendStatus(401);
  
  try {
    // 2. Get the ID from the authenticated session, NOT req.params
    const userId = req.user!.id; 
    const updates = { ...req.body };
    
    // 3. SECURITY: Prevent mass-assignment vulnerabilities.
    // Strip out fields that employees should never be able to change themselves.
    const protectedFields = [
      'id', 'role', 'salary', 'managerId', 'employmentStatus', 
      'department', 'position', 'hireDate', 'employeeId', 'isActive',
      'annualLeaveBalanceLimit', 'sickLeaveBalanceLimit', 'serviceIncentiveLeaveBalanceLimit',
      'annualLeaveBalance', 'sickLeaveBalance', 'serviceIncentiveLeaveBalance'
    ];
    
    protectedFields.forEach(field => {
      delete updates[field];
    });

    // 4. Convert timestamps to Date objects for Drizzle (for allowed fields)
    if (updates.birthDate) updates.birthDate = new Date(updates.birthDate);

    // 5. Update the user in the database
    const updatedUser = await storage.updateUser(userId, updates);
    
    if (!updatedUser) return res.status(404).send("User not found");
    
    // Return the updated profile
    res.json(updatedUser);
    
  } catch (error: any) {
    res.status(400).send(error.message || "Failed to update profile");
  }
});

  // --- Edit users ---
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  if (req.user!.role !== 'admin') return res.status(403).send("Only admins can edit users");
  try {
    const updates = { ...req.body };
    
    // FIX: Convert timestamps to Date objects for Drizzle
    if (updates.birthDate) updates.birthDate = new Date(updates.birthDate);
    if (updates.hireDate) updates.hireDate = new Date(updates.hireDate);

    const updatedUser = await storage.updateUser(req.params.id, updates);
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