import {
  User,
  InsertUser,
  LeaveRequest,
  InsertLeaveRequest,
  Payslip,
  Schedule,
  InsertSchedule,
  Document,
  InsertDocument,
  Announcement,
  InsertAnnouncement,
  Activity,
  InsertActivity,
  Training,
  UserTraining,
  InsertUserTraining
} from "@shared/schema";
import session from "express-session";
import { db, sqlite } from "./db";
import {
  users,
  leaveRequests,
  payslips,
  schedules,
  documents,
  announcements,
  activities,
  trainings,
  userTrainings
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

class SqliteSessionStore extends session.Store {
  private db: any;

  constructor(dbInstance: any) {
    super();
    this.db = dbInstance;
    this.initializeTable();
  }

  private initializeTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions(expire);
    `);
  }

  get(sid: string, callback: (err: any, session?: any) => void) {
    try {
      const stmt = this.db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expire > ?');
      const row = stmt.get(sid, Math.floor(Date.now() / 1000));
      if (row) {
        callback(null, JSON.parse(row.sess));
      } else {
        callback(null);
      }
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, sess: any, callback?: (err?: any) => void) {
    try {
      const expire = Math.floor(Date.now() / 1000) + (sess.cookie?.originalMaxAge || 86400000) / 1000;
      const stmt = this.db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)');
      stmt.run(sid, JSON.stringify(sess), expire);
      if (callback) callback();
    } catch (err) {
      if (callback) callback(err);
    }
  }

  destroy(sid: string, callback?: (err?: any) => void) {
    try {
      const stmt = this.db.prepare('DELETE FROM sessions WHERE sid = ?');
      stmt.run(sid);
      if (callback) callback();
    } catch (err) {
      if (callback) callback(err);
    }
  }

  clear(callback?: (err?: any) => void) {
    try {
      this.db.exec('DELETE FROM sessions');
      if (callback) callback();
    } catch (err) {
      if (callback) callback(err);
    }
  }
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getUsersByDepartment(department: string): Promise<User[]>;
  getUsersByManager(managerId: string): Promise<User[]>;

  createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest>;
  getLeaveRequestsByUser(userId: string): Promise<LeaveRequest[]>;
  getLeaveRequestById(id: string): Promise<LeaveRequest | undefined>;
  updateLeaveRequest(id: string, updates: Partial<LeaveRequest>): Promise<LeaveRequest | undefined>;
  getPendingLeaveRequests(managerId?: string): Promise<LeaveRequest[]>;

  createPayslip(payslip: Omit<Payslip, 'id' | 'generatedAt'>): Promise<Payslip>;
  getPayslipsByUser(userId: string): Promise<Payslip[]>;
  getPayslipById(id: string): Promise<Payslip | undefined>;

  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  getSchedulesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Schedule[]>;
  updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | undefined>;
  deleteSchedule(id: string): Promise<boolean>;

  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  getDocumentById(id: string): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;

  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  getActiveAnnouncements(department?: string): Promise<Announcement[]>;
  getAnnouncementById(id: string): Promise<Announcement | undefined>;
  updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement | undefined>;

  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivitiesByUser(userId: string, limit?: number): Promise<Activity[]>;

  getAllTrainings(): Promise<Training[]>;
  getUserTrainings(userId: string): Promise<UserTraining[]>;
  updateUserTraining(userId: string, trainingId: string, updates: Partial<UserTraining>): Promise<UserTraining | undefined>;

  sessionStore: any;
}

export class DbStorage implements IStorage {
  sessionStore: any;

  constructor(sqliteInstance: any) {
    this.sessionStore = new SqliteSessionStore(sqliteInstance);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getUsersByDepartment(department: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.department, department));
  }

  async getUsersByManager(managerId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.managerId, managerId));
  }

  async createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest> {
    const result = await db.insert(leaveRequests).values(request).returning();
    const leaveRequest = result[0];

    await this.createActivity({
      userId: request.userId,
      type: "leave_requested",
      description: `Leave request submitted for ${request.days} days`,
      metadata: { leaveRequestId: leaveRequest.id, startDate: request.startDate, endDate: request.endDate },
    });

    return leaveRequest;
  }

  async getLeaveRequestsByUser(userId: string): Promise<LeaveRequest[]> {
    return await db.select().from(leaveRequests)
      .where(eq(leaveRequests.userId, userId))
      .orderBy(desc(leaveRequests.createdAt));
  }

  async getLeaveRequestById(id: string): Promise<LeaveRequest | undefined> {
    const result = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
    return result[0];
  }

  async updateLeaveRequest(id: string, updates: Partial<LeaveRequest>): Promise<LeaveRequest | undefined> {
    const request = await this.getLeaveRequestById(id);
    if (!request) return undefined;

    const result = await db.update(leaveRequests).set(updates).where(eq(leaveRequests.id, id)).returning();
    const updatedRequest = result[0];

    if (updates.status && updates.status !== request.status) {
      await this.createActivity({
        userId: request.userId,
        type: updates.status === 'approved' ? 'leave_approved' : 'leave_rejected',
        description: `Leave request ${updates.status}`,
        metadata: { leaveRequestId: id },
      });
    }

    return updatedRequest;
  }

  async getPendingLeaveRequests(managerId?: string): Promise<LeaveRequest[]> {
    let query = db.select().from(leaveRequests).where(eq(leaveRequests.status, 'pending'));

    if (managerId) {
      const teamMembers = await this.getUsersByManager(managerId);
      const teamMemberIds = teamMembers.map(member => member.id);
      query = query.where(leaveRequests.userId.inArray(teamMemberIds));
    }

    return await query.orderBy(desc(leaveRequests.createdAt));
  }

  async createPayslip(payslip: Omit<Payslip, 'id' | 'generatedAt'>): Promise<Payslip> {
    const result = await db.insert(payslips).values(payslip).returning();
    return result[0];
  }

  async getPayslipsByUser(userId: string): Promise<Payslip[]> {
    return await db.select().from(payslips)
      .where(eq(payslips.userId, userId))
      .orderBy(desc(payslips.generatedAt));
  }

  async getPayslipById(id: string): Promise<Payslip | undefined> {
    const result = await db.select().from(payslips).where(eq(payslips.id, id)).limit(1);
    return result[0];
  }

  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    const result = await db.insert(schedules).values(schedule).returning();
    return result[0];
  }

  async getSchedulesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Schedule[]> {
    let query = db.select().from(schedules).where(eq(schedules.userId, userId));

    if (startDate && endDate) {
      query = query.where(and(
        schedules.date >= startDate,
        schedules.date <= endDate
      ));
    } else if (startDate) {
      query = query.where(schedules.date >= startDate);
    } else if (endDate) {
      query = query.where(schedules.date <= endDate);
    }

    return await query.orderBy(schedules.date);
  }

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | undefined> {
    const result = await db.update(schedules).set(updates).where(eq(schedules.id, id)).returning();
    return result[0];
  }

  async deleteSchedule(id: string): Promise<boolean> {
    const result = await db.delete(schedules).where(eq(schedules.id, id));
    return result.changes > 0;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const result = await db.insert(documents).values(document).returning();
    const newDocument = result[0];

    await this.createActivity({
      userId: document.userId,
      type: "document_uploaded",
      description: `Document uploaded: ${document.name}`,
      metadata: { documentId: newDocument.id, documentType: document.type },
    });

    return newDocument;
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return await db.select().from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.uploadedAt));
  }

  async getDocumentById(id: string): Promise<Document | undefined> {
    const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return result[0];
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return result.changes > 0;
  }

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

  async getAnnouncementById(id: string): Promise<Announcement | undefined> {
    const result = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
    return result[0];
  }

  async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement | undefined> {
    const result = await db.update(announcements).set(updates).where(eq(announcements.id, id)).returning();
    return result[0];
  }

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

  async getAllTrainings(): Promise<Training[]> {
    return await db.select().from(trainings);
  }

  async getUserTrainings(userId: string): Promise<UserTraining[]> {
    return await db.select().from(userTrainings).where(eq(userTrainings.userId, userId));
  }

  async updateUserTraining(userId: string, trainingId: string, updates: Partial<UserTraining>): Promise<UserTraining | undefined> {
    const existing = await db.select().from(userTrainings)
      .where(and(eq(userTrainings.userId, userId), eq(userTrainings.trainingId, trainingId)))
      .limit(1);

    let userTraining;
    if (existing.length === 0) {
      const result = await db.insert(userTrainings).values({
        userId,
        trainingId,
        status: "not_started",
        progress: 0,
        startedAt: null,
        completedAt: null,
      }).returning();
      userTraining = result[0];
    } else {
      userTraining = existing[0];
    }

    const result = await db.update(userTrainings)
      .set(updates)
      .where(and(eq(userTrainings.userId, userId), eq(userTrainings.trainingId, trainingId)))
      .returning();

    const updatedUserTraining = result[0];

    if (updates.status === 'completed') {
      const training = await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1);
      await this.createActivity({
        userId,
        type: "training_completed",
        description: `Completed training: ${training[0]?.title || 'Unknown'}`,
        metadata: { trainingId },
      });
    }

    return updatedUserTraining;
  }
}

export let storage: DbStorage;

export function initializeStorage(sqlite: any) {
  storage = new DbStorage(sqlite);
}
