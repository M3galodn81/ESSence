import { Router } from "express";
import { storage } from "../storage";
import { insertLeaveRequestSchema } from "@shared/schema";
import z, { ZodError } from "zod";

const router = Router();

// Helper to check if user has manager/admin privileges for leaves
const hasLeaveManagementPerms = (role: string) => {
  return ['admin', 'manager', 'hr'].includes(role);
};

// --- Make Leave Requests ---
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in to submit a request." });
  }

  try {
    const apiData = insertLeaveRequestSchema.parse({
      ...req.body,
      userId: req.user!.id,
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate),
    });
    
    const leaveRequest = await storage.createLeaveRequest(apiData);
    res.json(leaveRequest);
  } catch (error) {
    console.error(error);
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Bad Request", message: "Invalid leave request data", debug: error.errors });
    }
    return res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred while saving." });
  }
});

// --- Get Own Leave Requests ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }
  
  try {
    const leaveRequests = await storage.getLeaveRequestsByUser(req.user!.id);
    res.json(leaveRequests);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch your leave requests." });
  }
});

// --- Get ALL Leave Requests (For Managers/Admins) ---
router.get("/all", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }
  
  const user = req.user!;
  if (!hasLeaveManagementPerms(user.role)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view all leave requests." });
  }

  try {
    const leaveRequests = await storage.getAllLeaveRequests();
    res.json(leaveRequests);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch company leave requests." });
  }
});

// --- Get Pending Leave Requests (For Managers/Admins) ---
router.get("/pending", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  const user = req.user!;
  if (!hasLeaveManagementPerms(user.role)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view pending requests." });
  }

  try {
    const pendingRequests = await storage.getPendingLeaveRequests(user.role === 'manager' ? user.id : undefined);
    res.json(pendingRequests);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch pending requests." });
  }
});

// --- Edit Pending Leave Requests (Approve/Reject) ---
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  const user = req.user!;
  if (!hasLeaveManagementPerms(user.role)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to approve or reject leave requests." });
  }

  try {
    const updates = z.object({
      status: z.enum(["approved", "rejected"]),
      comments: z.string().optional(),
    }).parse(req.body);
    
    const updatedRequest = await storage.updateLeaveRequest(req.params.id, { 
      ...updates, 
      approvedBy: user.id, 
      approvedAt: new Date() 
    });
    
    if (!updatedRequest) {
      return res.status(404).json({ error: "Not Found", message: "Leave request not found." });
    }
    
    res.json(updatedRequest);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Bad Request", message: "Invalid approval/rejection data." });
    }
    res.status(500).json({ error: "Internal Server Error", message: "Failed to update the leave request status." });
  }
});

export default router;