import { Router } from "express";
import { storage } from "../storage";
import { hashPassword } from "../auth";
import { db } from "server/db";
import { insertLeaveRequestSchema } from "@shared/schema";
import z, { ZodError } from "zod";

const router = Router();


  // --- Make Leave Requests ---
  router.post("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
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
      if (error instanceof ZodError) return res.status(400).json({ message: "Invalid leave request data", debug: error.errors });
      return res.sendStatus(500);
    }
  });

  // --- Get Leave Requests ---
  router.get("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const leaveRequests = await storage.getLeaveRequestsByUser(req.user!.id);
    res.json(leaveRequests);
  });

   // --- Get Leave Requests ---
  router.get("/all", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const leaveRequests = await storage.getAllLeaveRequests();
    res.json(leaveRequests);
  });

  // --- Get Pending Leave Requests (for Managers/Admins) ---
  router.get("/pending", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    const pendingRequests = await storage.getPendingLeaveRequests(user.role === 'manager' ? user.id : undefined);
    res.json(pendingRequests);
  });

  // --- Edit Pending Leave Requests (for Managers/Admins) ---
  router.patch("/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    try {
      const updates = z.object({
        status: z.enum(["approved", "rejected"]),
        comments: z.string().optional(),
      }).parse(req.body);
      const updatedRequest = await storage.updateLeaveRequest(req.params.id, { ...updates, approvedBy: user.id, approvedAt: new Date() });
      if (!updatedRequest) return res.status(404).json({ message: "Leave request not found" });
      res.json(updatedRequest);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

export default router;