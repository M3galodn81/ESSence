import session from "express-session";
import {
  User,
  InsertUser,
  LeaveRequest,
  InsertLeaveRequest,
  Payslip,
  Schedule,
  InsertSchedule,
  Announcement,
  InsertAnnouncement,
  Activity,
  InsertActivity,
  Report,
  InsertReport,
  LaborCostData,
  InsertLaborCostData,
  Attendance,
  InsertAttendance,
  Break,
  InsertBreak,
  AnnouncementRead,
  InsertAnnouncementRead
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getUsersByDepartment(department: string): Promise<User[]>;
  getUsersByManager(managerId: string): Promise<User[]>;

  createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest>;
  getLeaveRequestsByUser(userId: string): Promise<LeaveRequest[]>;
  getLeaveRequestById(id: string): Promise<LeaveRequest | undefined>;
  updateLeaveRequest(id: string, updates: Partial<LeaveRequest>): Promise<LeaveRequest | undefined>;
  getPendingLeaveRequests(managerId?: string): Promise<LeaveRequest[]>;

  createPayslip(payslip: Omit<Payslip, 'id' | 'generatedAt'>): Promise<Payslip>;
  getPayslipsByUser(userId: string): Promise<Payslip[]>;
  getAllPayslips(userId: string): Promise<Payslip[]>;
  getPayslipById(id: string): Promise<Payslip | undefined>;

  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  getSchedulesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Schedule[]>;
  getAllSchedules(startDate?: Date, endDate?: Date): Promise<Schedule[]>;
  updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | undefined>;
  deleteSchedule(id: string): Promise<boolean>;

  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  getAllAnnouncements(department?: string): Promise<Announcement[]>;
  getActiveAnnouncements(department?: string): Promise<Announcement[]>;
  getAnnouncementById(id: string): Promise<Announcement | undefined>;
  updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement | undefined>;

  markAnnouncementRead(userId: string, announcementId: string): Promise<void>;
  getAnnouncementReads(announcementId: string): Promise<{ userId: string; readAt: Date; user: User }[]>;

  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivitiesByUser(userId: string, limit?: number): Promise<Activity[]>;
  getAllActivities(): Promise<Activity[]>;

  createReport(report: InsertReport): Promise<Report>;
  getReportsByUser(userId: string): Promise<Report[]>;
  getAllReports(): Promise<Report[]>;
  getReportById(id: string): Promise<Report | undefined>;
  updateReport(id: string, updates: Partial<Report>): Promise<Report | undefined>;

  createLaborCostData(data: InsertLaborCostData): Promise<LaborCostData>;
  getLaborCostData(year?: number): Promise<LaborCostData[]>;
  getLaborCostDataByMonth(month: number, year: number): Promise<LaborCostData | undefined>;
  updateLaborCostData(id: string, updates: Partial<LaborCostData>): Promise<LaborCostData | undefined>;

  // Attendance methods
  clockIn(userId: string, date: Date, notes?: string): Promise<Attendance>;
  clockOut(attendanceId: string): Promise<Attendance | undefined>;
  getTodayAttendance(userId: string): Promise<Attendance | undefined>;
  getAttendanceById(id: string): Promise<Attendance | undefined>;
  getAttendanceByUser(userId: string, startDate?: Date, endDate?: Date): Promise<Attendance[]>;
  getAllAttendance(startDate?: Date, endDate?: Date): Promise<Attendance[]>;
  startBreak(attendanceId: string, userId: string, breakType?: string, notes?: string): Promise<Break>;
  endBreak(breakId: string): Promise<Break | undefined>;
  getBreakById(id: string): Promise<Break | undefined>;
  getBreaksByAttendance(attendanceId: string): Promise<Break[]>;
  getActiveBreak(userId: string): Promise<Break | undefined>;
  getEmployeesForManager(managerId: string): Promise<User[]>;

  sessionStore: any;
}

export class SqliteSessionStore extends session.Store {
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