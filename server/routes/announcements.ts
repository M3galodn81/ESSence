import { insertAnnouncementSchema } from "@shared/schema";
import { Router } from "express";
import { storage } from "server/storage";

const router = Router();

  // --- Announcements ---
  router.get("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const announcements = await storage.getAllAnnouncements(req.user!.department);
    res.json(announcements);
  });

  // --- Create Announcement ---
  router.post("/", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (user.role !== 'manager' && user.role !== 'hr' && user.role !== 'admin') return res.status(403).json({ message: "Access denied" });
    try {
      const announcementData = insertAnnouncementSchema.parse({ ...req.body, authorId: user.id });
      const announcement = await storage.createAnnouncement(announcementData);
      res.json(announcement);
    } catch (error) {
      res.status(400).json({ message: "Invalid announcement data" });
    }
  });

  // --- Edit Announcement ---
  router.patch("/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    if (!["manager", "hr", "admin"].includes(user.role)) return res.status(403).json({ message: "Access denied" });
    try {
      const updateData = insertAnnouncementSchema.partial().parse(req.body);
      const updated = await storage.updateAnnouncement(req.params.id, updateData);
      if (!updated) return res.status(404).json({ message: "Announcement not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

export default router;