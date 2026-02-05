import { announcementReads, insertAnnouncementSchema } from "@shared/schema";
import { Router } from "express";
import { db } from "server/db";
import { storage } from "server/storage";
import { eq } from "drizzle-orm";
const router = Router();

  // --- Get All Announcements ---
  router.get("/", async (req, res) => {
    // Authentication check
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Get all announcements from storage
    const announcements = await storage.getAllAnnouncements(req.user!.department);
    res.json(announcements);
  });

  // --- Create Announcement ---
  router.post("/", async (req, res) => {

    // Authentication check
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;

    // Permission check
    if (user.role !== 'manager' && user.role !== 'payroll_officer' && user.role !== 'admin')
      return res.status(403).json({ message: "Access denied" });

    // Validate and create announcement
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
    // Authentication check
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user!;
    
    // Permission check
    if (!["manager", "hr", "admin"].includes(user.role)) 
      return res.status(403).json({ message: "Access denied" });
    
    // Validate and update announcement
    try {
      const updateData = insertAnnouncementSchema.partial().parse(req.body);
      const updated = await storage.updateAnnouncement(req.params.id, updateData);
      if (!updated) return res.status(404).json({ message: "Announcement not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  router.post("/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      await storage.markAnnouncementRead(req.user!.id, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // --- Get Announcement Readers (Who viewed it) ---
  router.get("/:id/reads", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const reads = await storage.getAnnouncementReads(req.params.id);
      res.json(reads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch readers" });
    }
  });


  router.get("/my-reads", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // 1. Ensure we are using the string version of the ID
      const userId = String(req.user!.id);

      const reads = await db.select({
        announcementId: announcementReads.announcementId
      })
      .from(announcementReads)
      .where(eq(announcementReads.userId, userId));

      // 2. Ensure we return an array of strings
      const readIds = reads.map(r => String(r.announcementId));
      res.json(readIds);
    } catch (error) {
      // 3. LOG THE ACTUAL ERROR to the console so you can see why SQLite is mad
      console.error("[My Reads Error]:", error); 
      res.status(500).json({ 
        message: "Failed to fetch read status",
        detail: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });


export default router;