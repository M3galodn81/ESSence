import { Router } from "express";
import { storage } from "../storage";
import { hashPassword } from "../auth";
import { Permission, RolePermissions, Role } from "@/lib/permissions";

const router = Router();

// Backend helper to check permissions based on the shared RBAC config
const hasServerPermission = (role: string, permission: Permission) => {
  const userPermissions = RolePermissions[role as Role] || [];
  return userPermissions.includes(permission);
};

// --- Get all users ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  const user = req.user!;
  if (!hasServerPermission(user.role, Permission.VIEW_ALL_USERS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view all users." });
  }

  try {
    const users = await storage.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch users." });
  }
});

// --- Make users ---
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  const user = req.user!;
  const requestedRole = req.body.role;

  if (!hasServerPermission(user.role, Permission.MANAGE_USERS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to create users." });
  }

  // Specific business logic: Managers can manage users, but ONLY create employees
  if (user.role === 'manager' && requestedRole !== 'employee') {
    return res.status(403).json({ error: "Forbidden", message: "Managers can only create employee accounts." });
  }

  try {
    const userData = { ...req.body, password: await hashPassword(req.body.password) };
    
    // Convert timestamps to Date objects for Drizzle
    if (userData.birthDate) userData.birthDate = new Date(userData.birthDate);
    if (userData.hireDate) userData.hireDate = new Date(userData.hireDate);

    // Auto-assign managerId if a manager is creating an employee
    if (user.role === 'manager' && requestedRole === 'employee' && !userData.managerId) {
      userData.managerId = user.id;
    }

    // Validate manager assignment if creating a manager
    if (requestedRole === 'manager') {
      if (!userData.managerId || userData.managerId === '') {
        delete userData.managerId;
      } else {
        const managerExists = await storage.getUser(userData.managerId);
        if (!managerExists) {
          return res.status(400).json({ error: "Bad Request", message: "Invalid manager ID provided." });
        }
      }
    }

    const newUser = await storage.createUser(userData, user.id);
    res.status(201).json(newUser);
  } catch (error: any) {
    res.status(400).json({ error: "Bad Request", message: error.message || "Failed to create user." });
  }
});

// --- Edit Own Profile ---
router.patch("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }
  
  if (!hasServerPermission(req.user!.role, Permission.VIEW_OWN_PROFILE)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to edit your profile." });
  }

  try {
    const userId = req.user!.id; 
    const updates = { ...req.body };
    
    // SECURITY: Prevent mass-assignment vulnerabilities.
    // Strip out all employment, salary, and newly added DOLE leave fields.
    const protectedFields = [
      'id', 'role', 'salary', 'managerId', 'employmentStatus', 
      'department', 'position', 'hireDate', 'employeeId', 'isActive',
      'annualLeaveBalance', 'annualLeaveBalanceLimit',
      'sickLeaveBalance', 'sickLeaveBalanceLimit',
      'serviceIncentiveLeaveBalance', 'serviceIncentiveLeaveBalanceLimit',
      'bereavementLeaveBalance', 'bereavementLeaveBalanceLimit',
      'maternityLeaveBalance', 'maternityLeaveBalanceLimit',
      'paternityLeaveBalance', 'paternityLeaveBalanceLimit',
      'soloParentLeaveBalance', 'soloParentLeaveBalanceLimit',
      'magnaCartaLeaveBalance', 'magnaCartaLeaveBalanceLimit',
      'vawcLeaveBalance', 'vawcLeaveBalanceLimit'
    ];
    
    protectedFields.forEach(field => {
      delete updates[field];
    });

    if (updates.birthDate) updates.birthDate = new Date(updates.birthDate);

    const updatedUser = await storage.updateUser(userId, updates);
    
    if (!updatedUser) {
      return res.status(404).json({ error: "Not Found", message: "User not found." });
    }
    
    res.json(updatedUser);
  } catch (error: any) {
    res.status(400).json({ error: "Bad Request", message: error.message || "Failed to update profile." });
  }
});

// --- Edit users (Admins/HR/Managers) ---
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_USERS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to edit users." });
  }

  try {
    const updates = { ...req.body };
    
    if (updates.birthDate) updates.birthDate = new Date(updates.birthDate);
    if (updates.hireDate) updates.hireDate = new Date(updates.hireDate);

    const updatedUser = await storage.updateUser(req.params.id, updates);
    if (!updatedUser) {
      return res.status(404).json({ error: "Not Found", message: "User not found." });
    }
    res.json(updatedUser);
  } catch (error: any) {
    res.status(400).json({ error: "Bad Request", message: error.message || "Failed to update user." });
  }
});

// --- Change password (Admins/HR) ---
router.patch("/:id/password", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.MANAGE_USERS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to change user passwords." });
  }

  try {
    const hashedPassword = await hashPassword(req.body.password);
    const updatedUser = await storage.updateUser(req.params.id, { password: hashedPassword });
    if (!updatedUser) {
      return res.status(404).json({ error: "Not Found", message: "User not found." });
    }
    res.json({ message: "Password updated successfully." });
  } catch (error: any) {
    res.status(400).json({ error: "Bad Request", message: error.message || "Failed to change password." });
  }
});

// --- Delete users ---
router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }
  
  const user = req.user!;
  
  if (!hasServerPermission(user.role, Permission.MANAGE_USERS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to delete users." });
  }

  if (user.id === req.params.id) {
    return res.status(400).json({ error: "Bad Request", message: "You cannot delete your own account." });
  }

  try {
    await storage.deleteUser(req.params.id);
    res.json({ message: "User deleted successfully." });
  } catch (error: any) {
    res.status(400).json({ error: "Bad Request", message: error.message || "Failed to delete user." });
  }
});

export default router;