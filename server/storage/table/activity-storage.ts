import { db, } from "../../db";
import { Activity,  activities, InsertActivity } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { BaseStorage } from "./base-storage";

export class ActivityStorage extends BaseStorage{
async createActivity(activity: InsertActivity): Promise<Activity> {
    const result = await db.insert(activities).values(activity).returning();
    return result[0];
  }

  async getActivitiesByUser(userId: string, limit = 10): Promise<Activity[]> {
    return await db.select().from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async getAllActivities(limit = 10): Promise<Activity[]> {
    return await db.select().from(activities)
      .limit(limit)
      .orderBy(desc(activities.createdAt));
  }
}