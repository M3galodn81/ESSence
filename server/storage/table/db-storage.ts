import { IStorage, SqliteSessionStore } from "../types";
import { ActivityStorage } from "./activity-storage";
import { AttendanceStorage } from "./attendance-storage";
import { LaborCostStorage } from "./labor-cost-storage";
import { LeaveRequestStorage } from "./leave-request-storage"; 
import { PayslipStorage } from "./payslip-storage";
import { ScheduleStorage } from "./schedule-storage";
import { UserStorage } from "./user-storage";
import { AnnouncementStorage } from "./announcement-storage"; // Don't forget this one
import { ReportStorage } from "./report-storage"; // And this one
import { 
  User, InsertUser, LeaveRequest, InsertLeaveRequest, Payslip, Schedule, 
  InsertSchedule, Announcement, InsertAnnouncement, Activity, InsertActivity, 
  Report, InsertReport, LaborCostData, InsertLaborCostData, Attendance, Break 
} from "@shared/schema";

export class DbStorage implements IStorage {
  public sessionStore: any;
  public users: UserStorage;
  public attendance: AttendanceStorage;
  public leaves: LeaveRequestStorage;
  public activities: ActivityStorage;
  public payslips: PayslipStorage;
  public schedules: ScheduleStorage;
  public laborCosts: LaborCostStorage;
  public announcements: AnnouncementStorage;
  public reports: ReportStorage;

  constructor(sqliteInstance: any) {
    this.sessionStore = new SqliteSessionStore(sqliteInstance);
    
    // Initialize sub-repositories
    this.users = new UserStorage();
    this.activities = new ActivityStorage();
    // Pass this.users/this.activities if your sub-repos need them
    this.leaves = new LeaveRequestStorage();
    this.attendance = new AttendanceStorage();
    this.payslips = new PayslipStorage();
    this.schedules = new ScheduleStorage();
    this.laborCosts = new LaborCostStorage();
    this.announcements = new AnnouncementStorage();
    this.reports = new ReportStorage();
  }

  // --- User Methods ---
  async getUser(id: string) { return this.users.getUser(id); }
  async getUserByUsername(username: string) { return this.users.getUserByUsername(username); }
  async getAllUsers() { return this.users.getAllUsers(); }
  async getAllEmployees() { return this.users.getAllEmployees(); }
  async createUser(user: InsertUser) { return this.users.createUser(user); }
  async updateUser(id: string, updates: Partial<User>) { return this.users.updateUser(id, updates); }
  async deleteUser(id: string) { return this.users.deleteUser(id); }
  async getUsersByDepartment(dept: string) { return this.users.getUsersByDepartment(dept); }
  async getUsersByManager(mgrId: string) { return this.users.getUsersByManager(mgrId); }
  async getEmployeesForManager(mgrId: string) { return this.users.getEmployeesForManager(mgrId); }

  // --- Leave Request Methods ---
  async createLeaveRequest(req: InsertLeaveRequest) { return this.leaves.createLeaveRequest(req); }
  async getLeaveRequestsByUser(userId: string) { return this.leaves.getLeaveRequestsByUser(userId); }
  async getLeaveRequestById(id: string) { return this.leaves.getLeaveRequestById(id); }
  async updateLeaveRequest(id: string, updates: Partial<LeaveRequest>) { return this.leaves.updateLeaveRequest(id, updates); }
  async getPendingLeaveRequests(mgrId?: string) { return this.leaves.getPendingLeaveRequests(mgrId); }
  async getAllLeaveRequests() { return this.leaves.getAllLeaveRequests(); }

  // --- Attendance Methods ---
  async clockIn(userId: string, date: Date, notes?: string) { return this.attendance.clockIn(userId, date, notes); }
  async clockOut(id: string) { return this.attendance.clockOut(id); }
  async getTodayAttendance(userId: string) { return this.attendance.getTodayAttendance(userId); }
  async getAttendanceById(id: string) { return this.attendance.getAttendanceById(id); }
  async getAttendanceByUser(userId: string, s?: Date, e?: Date) { return this.attendance.getAttendanceByUser(userId, s, e); }
  async getAllAttendance(s?: Date, e?: Date) { return this.attendance.getAllAttendance(s, e); }
  async startBreak(aId: string, uId: string, type?: string, n?: string) { return this.attendance.startBreak(aId, uId, type, n); }
  async endBreak(id: string) { return this.attendance.endBreak(id); }
  async getBreakById(id: string) { return this.attendance.getBreakById(id); }
  async getBreaksByAttendance(id: string) { return this.attendance.getBreaksByAttendance(id); }
  async getActiveBreak(userId: string) { return this.attendance.getActiveBreak(userId); }

  // --- Announcement Methods ---
  async createAnnouncement(a: InsertAnnouncement) { return this.announcements.createAnnouncement(a); }
  async getAllAnnouncements(dept?: string) { return this.announcements.getAllAnnouncements(dept); }
  async getActiveAnnouncements(dept?: string) { return this.announcements.getActiveAnnouncements(dept); }
  async getAnnouncementById(id: string) { return this.announcements.getAnnouncementById(id); }
  async updateAnnouncement(id: string, up: Partial<Announcement>) { return this.announcements.updateAnnouncement(id, up); }
  async markAnnouncementRead(uId: string, aId: string) { return this.announcements.markAnnouncementRead(uId, aId); }
  async getAnnouncementReads(aId: string) { return this.announcements.getAnnouncementReads(aId); }

  // --- Activity Methods ---
  async createActivity(act: InsertActivity) { return this.activities.createActivity(act); }
  async getActivitiesByUser(uId: string, limit?: number) { return this.activities.getActivitiesByUser(uId, limit); }
  async getAllActivities() { return this.activities.getAllActivities(); }

  // --- Report Methods ---
  async createReport(rep: InsertReport) { return this.reports.createReport(rep); }
  async getReportsByUser(uId: string) { return this.reports.getReportsByUser(uId); }
  async getAllReports() { return this.reports.getAllReports(); }
  async getReportById(id: string) { return this.reports.getReportById(id); }
  async updateReport(id: string, up: Partial<Report>) { return this.reports.updateReport(id, up); }

  // --- Remaining Methods (Schedules, Payslips, Labor) ---
  async createPayslip(p: any) { return this.payslips.createPayslip(p); }
  async getPayslipsByUser(uId: string) { return this.payslips.getPayslipsByUser(uId); }
  async getAllPayslips(uId: string) { return this.payslips.getAllPayslips(); }
  async getPayslipById(id: string) { return this.payslips.getPayslipById(id); }

  async createSchedule(s: InsertSchedule) { return this.schedules.createSchedule(s); }
  async getSchedulesByUser(uId: string, s?: Date, e?: Date) { return this.schedules.getSchedulesByUser(uId, s, e); }
  async getAllSchedules(s?: Date, e?: Date) { return this.schedules.getAllSchedules(s, e); }
  async updateSchedule(id: string, up: Partial<Schedule>) { return this.schedules.updateSchedule(id, up); }
  async deleteSchedule(id: string) { return this.schedules.deleteSchedule(id); }

  async createLaborCostData(d: InsertLaborCostData) { return this.laborCosts.createLaborCostData(d); }
  async getLaborCostData(year?: number) { return this.laborCosts.getLaborCostData(year); }
  async getLaborCostDataByMonth(m: number, y: number) { return this.laborCosts.getLaborCostDataByMonth(m, y); }
  async updateLaborCostData(id: string, up: Partial<LaborCostData>) { return this.laborCosts.updateLaborCostData(id, up); }
}