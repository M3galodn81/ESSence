import { announcementReads, insertAnnouncementSchema } from "@shared/schema";
import { Router } from "express";
import { db } from "server/db";
import { storage } from "server/storage";
import { eq } from "drizzle-orm";
import { Permission, RolePermissions, Role } from "@/lib/permissions";

const router = Router();

// Backend helper to check permissions based on the shared RBAC config
const hasServerPermission = (role: string, permission: Permission) => {
  const userPermissions = RolePermissions[role as Role] || [];
  return userPermissions.includes(permission);
};

// --- Get All Announcements ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.VIEW_ANNOUNCEMENTS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view announcements." });
  }

  try {
    const announcements = await storage.getAllAnnouncements(req.user!.department);
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch announcements." });
  }
});

// --- Create Announcement ---
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  const user = req.user!;
  if (!hasServerPermission(user.role, Permission.MANAGE_ANNOUNCEMENTS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to create announcements." });
  }

  try {
    const announcementData = insertAnnouncementSchema.parse({ ...req.body, authorId: user.id });
    const announcement = await storage.createAnnouncement(announcementData);
    res.status(201).json(announcement);
  } catch (error) {
    res.status(400).json({ error: "Bad Request", message: "Invalid announcement data provided." });
  }
});

// --- Edit Announcement ---
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  const user = req.user!;
  if (!hasServerPermission(user.role, Permission.MANAGE_ANNOUNCEMENTS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to edit announcements." });
  }

  try {
    const updateData = insertAnnouncementSchema.partial().parse(req.body);
    const updated = await storage.updateAnnouncement(req.params.id, updateData);
    
    if (!updated) {
      return res.status(404).json({ error: "Not Found", message: "Announcement not found." });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: "Bad Request", message: "Invalid update data provided." });
  }
});

// --- Mark Announcement as Read ---
router.post("/:id/read", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.VIEW_ANNOUNCEMENTS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to interact with announcements." });
  }

  try {
    await storage.markAnnouncementRead(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to mark announcement as read." });
  }
});

// --- Get Announcement Readers (Who viewed it) ---
router.get("/:id/reads", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  // Usually, only managers/admins who can MANAGE announcements need to see the read receipts
  if (!hasServerPermission(req.user!.role, Permission.MANAGE_ANNOUNCEMENTS)) {
    return res.status(403).json({ error: "Forbidden", message: "You do not have permission to view read receipts." });
  }

  try {
    const reads = await storage.getAnnouncementReads(req.params.id);
    res.json(reads);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch readers." });
  }
});

// --- Get Current User's Read Announcements ---
router.get("/my-reads", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized", message: "Please log in." });
  }

  if (!hasServerPermission(req.user!.role, Permission.VIEW_ANNOUNCEMENTS)) {
    return res.status(403).json({ error: "Forbidden", message: "Access denied." });
  }

  try {
    const userId = String(req.user!.id);

    const reads = await db.select({
      announcementId: announcementReads.announcementId
    })
    .from(announcementReads)
    .where(eq(announcementReads.userId, userId));

    const readIds = reads.map(r => String(r.announcementId));
    res.json(readIds);
  } catch (error) {
    console.error("[My Reads Error]:", error); 
    res.status(500).json({ 
      error: "Internal Server Error",
      message: "Failed to fetch read status",
      detail: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

export default router;