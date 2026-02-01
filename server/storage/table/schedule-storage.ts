import { db, } from "../../db";
import { Schedule, schedules, InsertSchedule} from "@shared/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { BaseStorage } from "./base-storage";

export class ScheduleStorage extends BaseStorage{
    async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
        const result = await db.insert(schedules).values(schedule).returning();
        return result[0];
    }

    async getSchedulesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Schedule[]> {
    let query = db.select().from(schedules).where(eq(schedules.userId, userId));

    if (startDate && endDate) {
        query = query.where(and(
        gte(schedules.date, startDate),
        lte(schedules.date, endDate)
        ));
    } else if (startDate) {
        query = query.where(gte(schedules.date, startDate));
    } else if (endDate) {
        query = query.where(lte(schedules.date, endDate));
    }

    return await query.orderBy(asc(schedules.date));
    }

    async getAllSchedules(startDate?: Date, endDate?: Date): Promise<Schedule[]> {
    let query = db.select().from(schedules);

    if (startDate && endDate) {
        query = query.where(and(
        gte(schedules.date, startDate),
        lte(schedules.date, endDate)
        ));
    } else if (startDate) {
        query = query.where(gte(schedules.date, startDate));
    } else if (endDate) {
        query = query.where(lte(schedules.date, endDate));
    }

    return await query.orderBy(asc(schedules.date));
    }

    async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | undefined> {
        const result = await db.update(schedules).set(updates).where(eq(schedules.id, id)).returning();
        return result[0];
    }

    async deleteSchedule(id: string): Promise<boolean> {
        const result = await db.delete(schedules).where(eq(schedules.id, id));
        return result.changes > 0;
    }
}