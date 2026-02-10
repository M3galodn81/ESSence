import { Router } from "express";
import { db } from "../db";
import { announcements, leaveRequests, payslips, reports } from "@shared/schema";
import { eq, and, desc, gt, or, gte } from "drizzle-orm";
import { subDays } from "date-fns";

const router = Router();

// --- Get Notifications ---
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  const user = req.user!;

  try {
    // Fetch items from the last 7 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    // 1. Recent Announcements (Active & Recent)
    const recentAnnouncements = await db.select()
      .from(announcements)
      .where(and(
        eq(announcements.isActive, true),
        gte(announcements.createdAt, cutoffDate)
      ))
      .orderBy(desc(announcements.createdAt));

    // Filter announcements by department
    const relevantAnnouncements = recentAnnouncements.filter(a => {
        const targets = a.targetDepartments as string[] | null;
        if (!targets || targets.length === 0) return true;
        return user.department && targets.includes(user.department);
    });

    // 2. Recent Leave Request Updates
    const recentLeaveUpdates = await db.select()
      .from(leaveRequests)
      .where(and(
        eq(leaveRequests.userId, user.id),
        gte(leaveRequests.updatedAt, cutoffDate),
        or(eq(leaveRequests.status, "approved"), eq(leaveRequests.status, "rejected"))
      ))
      .orderBy(desc(leaveRequests.updatedAt));

    // 3. Recent Payslips
    // FIX: Explicitly select only existing columns to avoid "no such column: period" error if DB is outdated
    const recentPayslips = await db.select({
        id: payslips.id,
        generatedAt: payslips.generatedAt,
        month: payslips.month,
        year: payslips.year,
        period: payslips.period
      })
      .from(payslips)
      .where(and(
        eq(payslips.userId, user.id),
        gte(payslips.generatedAt, cutoffDate)
      ))
      .orderBy(desc(payslips.generatedAt));

    // 4. NEW: NTE Notifications
    // A. For Employee: "Action Required: Submit NTE"
    const pendingNTEs = await db.select()
        .from(reports)
        .where(and(
            eq(reports.assignedTo, user.id),
            eq(reports.nteRequired, true),
            or(eq(reports.nteContent, ""), eq(reports.nteContent, null))
        ));

    // B. For Manager: "Update: NTE Submitted"
    let submittedNTEs: typeof reports.$inferSelect[] = [];
    if (['admin', 'manager'].includes(user.role)) {
        submittedNTEs = await db.select()
            .from(reports)
            .where(and(
                eq(reports.userId, user.id), // Created by this manager
                eq(reports.nteRequired, true),
                gte(reports.updatedAt, cutoffDate) // Recently updated
            ))
            // Filter in JS for non-null content to be safe
            .then(rows => rows.filter(r => r.nteContent && r.nteContent.length > 0));
    }
    
    // Combine into a unified notification structure
    const notifications = [
        ...relevantAnnouncements.map(a => ({
            id: `ann-${a.id}`,
            type: 'announcement',
            title: 'New Announcement',
            message: a.title,
            timestamp: a.createdAt,
            link: '/announcements',
            read: false
        })),
        ...recentLeaveUpdates.map(l => ({
            id: `leave-${l.id}`,
            type: 'leave',
            title: `Leave ${l.status === 'approved' ? 'Approved' : 'Rejected'}`,
            message: `Your request for ${new Date(l.startDate).toLocaleDateString()} was ${l.status}.`,
            timestamp: l.updatedAt,
            link: '/leave-management',
            read: false
        })),
        ...recentPayslips.map(p => ({
            id: `pay-${p.id}`,
            type: 'payslip',
            title: 'Payslip Available',
            // Fallback to MM/YYYY format since 'period' column might be missing in DB
            message: `Payslip for ${p.month} (${p.period || 'N/A'}) /${p.year} is now available.`,
            timestamp: p.generatedAt,
            link: '/payslips',
            read: false
        })),
        ...pendingNTEs.map(r => ({
            id: `nte-req-${r.id}`,
            type: 'alert', // Use specific styling in frontend if available
            title: 'Action Required: Submit NTE',
            message: `You are required to submit a Notice to Explain regarding: ${r.title}`,
            timestamp: r.createdAt,
            link: '/reports',
            read: false
        })),

        // Map Submitted NTEs (For Manager)
        ...submittedNTEs.map(r => ({
            id: `nte-sub-${r.id}`,
            type: 'info',
            title: 'NTE Submitted',
            message: `Employee has submitted their explanation for: ${r.title}`,
            timestamp: r.updatedAt,
            link: '/reports',
            read: false
        }))
    ];

    // Sort combined list by newest first
    notifications.sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());

    res.json(notifications);

  } catch (error) {
    console.error("Notifications fetch error:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

export default router;