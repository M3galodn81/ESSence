import { db } from "../../db";
import { users, activities, Activity, InsertActivity, User } from "@shared/schema";
import { eq } from "drizzle-orm";

export class BaseStorage {
  async createActivity(activity: InsertActivity) {
    const result = await db.insert(activities).values(activity).returning();
    return result[0];
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  // Shared User Update (needed for leave balances, clock-ins, etc.)
  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getUsersByManager(managerId: string): Promise<User[]> {
      return await db.select().from(users).where(eq(users.managerId, managerId));
  }


}