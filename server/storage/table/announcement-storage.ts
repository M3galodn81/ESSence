import { db, } from "../../db";
import { Announcement, announcements, announcementReads, InsertAnnouncement, users , User} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { BaseStorage } from "./base-storage";

export class AnnouncementStorage extends BaseStorage{
      async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const result = await db.insert(announcements).values(announcement).returning();
    return result[0];
  }

  async getActiveAnnouncements(department?: string): Promise<Announcement[]> {
    let query = db.select().from(announcements).where(eq(announcements.isActive, true));

    if (department) {
      const allAnnouncements = await query;
      return allAnnouncements.filter(announcement =>
        !announcement.targetDepartments ||
        (announcement.targetDepartments as string[]).includes(department)
      ).sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
    }

    return await query.orderBy(desc(announcements.createdAt));
  }
  
  async getAllAnnouncements(department?: string): Promise<Announcement[]> {
    const query = db.select().from(announcements);

    const allAnnouncements = await query;

    const visibleAnnouncements = allAnnouncements
      .filter(announcement =>
        // Show if no targetDepartments OR empty array OR includes the user's department
        !announcement.targetDepartments ||
        (announcement.targetDepartments as string[]).length === 0 ||
        (announcement.targetDepartments as string[]).includes(department!)
      )
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());

    return visibleAnnouncements;
  }

  async getAnnouncementById(id: string): Promise<Announcement | undefined> {
    const result = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
    return result[0];
  }

  async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement | undefined> {
    const result = await db.update(announcements).set(updates).where(eq(announcements.id, id)).returning();
    return result[0];
  }

  async markAnnouncementRead(userId: string, announcementId: string): Promise<void> {
    const uId = String(userId);
    const aId = String(announcementId);

    const existing = await db.select()
      .from(announcementReads)
      .where(
        and(
          eq(announcementReads.userId, uId),
          eq(announcementReads.announcementId, aId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(announcementReads).values({
        userId: uId,
        announcementId: aId,
        readAt: new Date(), // SQLite stores this as an ISO string or integer
      });
    }
  }

  async getAnnouncementReads(announcementId: string): Promise<{ userId: string; readAt: Date; user: User }[]> {
    // Join reads with user table to get names
    const results = await db.select({
      read: announcementReads,
      user: users,
    })
    .from(announcementReads)
    // Join condition: text ID to text ID
    .innerJoin(users, eq(announcementReads.userId, users.id))
    // REMOVED parseInt()
    .where(eq(announcementReads.announcementId, announcementId));

    return results.map(({ read, user }) => ({
      userId: user.id,
      readAt: read.readAt!, // The '!' asserts it's not null, or use: read.readAt ?? new Date()
      user: user,
    }));
  }
}
