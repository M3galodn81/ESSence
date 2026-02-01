import { db, } from "../../db";
import { Attendance, attendance, breaks, Break, InsertBreak} from "@shared/schema";
import { and, asc, gte, lte , desc, eq, isNull } from "drizzle-orm";
import { BaseStorage } from "./base-storage";

export class AttendanceStorage extends BaseStorage{
  async clockIn(userId: string, date: Date, notes?: string): Promise<Attendance> {
    const result = await db.insert(attendance).values({
      userId,
      date,
      timeIn: new Date(),
      status: "clocked_in",
      notes,
    }).returning();
    return result[0];
  }

  async clockOut(attendanceId: string): Promise<Attendance | undefined> {
    const now = new Date();
    const attendanceRecord = await this.getAttendanceById(attendanceId);

    if (!attendanceRecord) return undefined;

    // Calculate total work minutes
    const timeInMs = new Date(attendanceRecord.timeIn).getTime();
    const timeOutMs = now.getTime();
    const totalMinutes = Math.floor((timeOutMs - timeInMs) / (1000 * 60));
    const workMinutes = totalMinutes - (attendanceRecord.totalBreakMinutes || 0);

    const result = await db.update(attendance)
      .set({
        timeOut: now,
        status: "clocked_out",
        totalWorkMinutes: workMinutes,
        updatedAt: now,
      })
      .where(eq(attendance.id, attendanceId))
      .returning();
    return result[0];
  }

  async getTodayAttendance(userId: string): Promise<Attendance | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await db.select().from(attendance)
      .where(
        and(
          eq(attendance.userId, userId),
          gte(attendance.date, today),
          lte(attendance.date, tomorrow)
        )
      )
      .orderBy(desc(attendance.createdAt))
      .limit(1);
    return result[0];
  }

  async getAttendanceById(id: string): Promise<Attendance | undefined> {
    const result = await db.select().from(attendance)
      .where(eq(attendance.id, id))
      .limit(1);
    return result[0];
  }

  async getAttendanceByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Attendance[]> {
    let query = db.select().from(attendance).where(eq(attendance.userId, userId));

    if (startDate && endDate) {
      query = query.where(
        and(
          eq(attendance.userId, userId),
          gte(attendance.date, startDate),
          lte(attendance.date, endDate)
        )
      );
    }

    return await query.orderBy(desc(attendance.date));
  }

  async getAllAttendance(startDate?: Date, endDate?: Date): Promise<Attendance[]> {
    let query = db.select().from(attendance);

    if (startDate && endDate) {
      query = query.where(
        and(
          gte(attendance.date, startDate),
          lte(attendance.date, endDate)
        )
      );
    }

    return await query.orderBy(desc(attendance.date));
  }

  // Break methods
  async startBreak(attendanceId: string, userId: string, breakType: string = "regular", notes?: string): Promise<Break> {
    // Update attendance status
    await db.update(attendance)
      .set({ status: "on_break", updatedAt: new Date() })
      .where(eq(attendance.id, attendanceId));

    const result = await db.insert(breaks).values({
      attendanceId,
      userId,
      breakStart: new Date(),
      breakType,
      notes,
    }).returning();
    return result[0];
  }

  async endBreak(breakId: string): Promise<Break | undefined> {
    const now = new Date();
    const breakRecord = await this.getBreakById(breakId);

    if (!breakRecord) return undefined;

    // Calculate break minutes
    const breakStartMs = new Date(breakRecord.breakStart).getTime();
    const breakEndMs = now.getTime();
    const breakMinutes = Math.floor((breakEndMs - breakStartMs) / (1000 * 60));

    const result = await db.update(breaks)
      .set({
        breakEnd: now,
        breakMinutes,
      })
      .where(eq(breaks.id, breakId))
      .returning();

    // Update attendance total break minutes and status
    const attendanceRecord = await this.getAttendanceById(breakRecord.attendanceId);
    if (attendanceRecord) {
      const totalBreakMinutes = (attendanceRecord.totalBreakMinutes || 0) + breakMinutes;
      await db.update(attendance)
        .set({
          totalBreakMinutes,
          status: "clocked_in",
          updatedAt: now,
        })
        .where(eq(attendance.id, breakRecord.attendanceId));
    }

    return result[0];
  }

  async getBreakById(id: string): Promise<Break | undefined> {
    const result = await db.select().from(breaks)
      .where(eq(breaks.id, id))
      .limit(1);
    return result[0];
  }

  async getBreaksByAttendance(attendanceId: string): Promise<Break[]> {
    return await db.select().from(breaks)
      .where(eq(breaks.attendanceId, attendanceId))
      .orderBy(asc(breaks.breakStart));
  }

  async getActiveBreak(userId: string): Promise<Break | undefined> {
    const result = await db.select().from(breaks)
      .where(
        and(
          eq(breaks.userId, userId),
          isNull(breaks.breakEnd)
        )
      )
      .orderBy(desc(breaks.createdAt))
      .limit(1);
    return result[0];
  }
}