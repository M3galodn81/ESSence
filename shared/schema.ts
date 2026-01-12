import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const json = <T>(name: string) => {
  return text(name, { mode: 'json' }).$type<T>();
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default("employee"),
  department: text("department"),
  position: text("position"),
  employeeId: text("employee_id").unique(),
  phoneNumber: text("phone_number"),
  emergencyContact: json<Record<string, any>>("emergency_contact"),
  address: json<Record<string, any>>("address"),
  hireDate: integer("hire_date", { mode: 'timestamp_ms' }),
  salary: integer("salary"),
  managerId: text("manager_id").references(() => users.id),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  profilePicture: text("profile_picture"),
  
  annualLeaveBalance: integer("annual_leave_balance").default(15),
  sickLeaveBalance: integer("sick_leave_balance").default(10),
  serviceIncentiveLeaveBalance: integer("emergency_leave_balance").default(5),

  annualLeaveBalanceLimit: integer("annual_leave_balance_limit").default(15),
  sickLeaveBalanceLimit: integer("sick_leave_balance_limit").default(10),
  serviceIncentiveLeaveBalanceLimit: integer("emergency_leave_balance_limit").default(5),

  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
}); 

export const leaveRequests = sqliteTable("leave_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  startDate: integer("start_date", { mode: 'timestamp_ms' }).notNull(),
  endDate: integer("end_date", { mode: 'timestamp_ms' }).notNull(),
  days: integer("days").notNull(),
  reason: text("reason"),
  status: text("status").default("pending"),
  approvedBy: text("approved_by").references(() => users.id),
  approvedAt: integer("approved_at", { mode: 'timestamp_ms' }),
  comments: text("comments"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
});

export const payslips = sqliteTable("payslips", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  period: integer("period").notNull().default(1), // Added: 1 for 1st Half, 2 for 2nd Half
  basicSalary: integer("basic_salary").notNull(),
  allowances: json<Record<string, any>>("allowances"),
  deductions: json<Record<string, any>>("deductions"),
  grossPay: integer("gross_pay").notNull(),
  netPay: integer("net_pay").notNull(),
  generatedAt: integer("generated_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  date: integer("date", { mode: 'timestamp_ms' }).notNull(),
  startTime: integer("start_time", { mode: 'timestamp_ms' }).notNull(),
  endTime: integer("end_time", { mode: 'timestamp_ms' }).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  
  shiftRole: text("shift_role"), 
  isAllDay: integer("is_all_day", { mode: 'boolean' }).default(false),
  status: text("status").default("scheduled"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
});

export const holidays = sqliteTable("holidays", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  date: integer("date", { mode: 'timestamp_ms' }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'regular' | 'special'
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").default("general"),
  authorId: text("author_id").notNull().references(() => users.id),
  targetDepartments: json<Record<string, any>>("target_departments"),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  details: json<Record<string, any>>("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});

// shared/schema.ts

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id), // The reporter
  
  // New granular categories
  category: text("category").notNull().default("accident"), // 'customer', 'employee', 'accident', 'security', 'medical', 'property'
  
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").default("low"), 
  status: text("status").default("pending"), 
  location: text("location").notNull(),

  // "Real Life" Form Fields
  dateOccurred: integer("date_occurred", { mode: 'timestamp_ms' }).notNull(),
  timeOccurred: text("time_occurred").notNull(), // e.g., "14:30"
  partiesInvolved: text("parties_involved"), // Names of people involved (Guest names, Staff names)
  witnesses: text("witnesses"), // Names/Contacts of witnesses
  actionTaken: text("action_taken"), // What did you do immediately? (e.g. "Called police", "Applied First Aid")
  
  // Specific Details (JSON for flexibility)
  // For Property: { itemName, estimatedCost }
  // For Medical: { injuryType, hospitalName }
  // For Security: { policeReportNumber, stolenItems }
  details: json<Record<string, any>>("details"),
  
  images: json<string[]>("images"), // For evidence photos

  assignedTo: text("assigned_to").references(() => users.id),
  resolvedBy: text("resolved_by").references(() => users.id),
  resolvedAt: integer("resolved_at", { mode: 'timestamp_ms' }),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
});



export const laborCostData = sqliteTable("labor_cost_data", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  totalSales: integer("total_sales").notNull(),
  totalLaborCost: integer("total_labor_cost").notNull(),
  laborCostPercentage: integer("labor_cost_percentage").notNull(),
  status: text("status"),
  performanceRating: text("performance_rating"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
});

export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  date: integer("date", { mode: 'timestamp_ms' }).notNull(),
  timeIn: integer("time_in", { mode: 'timestamp_ms' }).notNull(),
  timeOut: integer("time_out", { mode: 'timestamp_ms' }),
  status: text("status").default("clocked_in"), // clocked_in, clocked_out, on_break
  totalBreakMinutes: integer("total_break_minutes").default(0),
  totalWorkMinutes: integer("total_work_minutes"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
});

export const breaks = sqliteTable("breaks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  attendanceId: text("attendance_id").notNull().references(() => attendance.id),
  userId: text("user_id").notNull().references(() => users.id),
  breakStart: integer("break_start", { mode: 'timestamp_ms' }).notNull(),
  breakEnd: integer("break_end", { mode: 'timestamp_ms' }),
  breakMinutes: integer("break_minutes"),
  breakType: text("break_type").default("regular"), // regular, lunch, emergency
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  status: true,
  approvedBy: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPayslipSchema = createInsertSchema(payslips).omit({
  id: true,
  generatedAt: true,
});

export const insertScheduleApiSchema = z.object({
  userId: z.string(),
  date: z.number(),
  startTime: z.number(),
  endTime: z.number(),
  type: z.string(),
  title: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  shiftRole: z.string().optional(),
  isAllDay: z.boolean().optional(),
  status: z.string().optional(),
});

export const insertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  status: true,
  assignedTo: true,
  resolvedBy: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLaborCostDataSchema = createInsertSchema(laborCostData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  status: true,
  totalBreakMinutes: true,
  totalWorkMinutes: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBreakSchema = createInsertSchema(breaks).omit({
  id: true,
  breakMinutes: true,
  createdAt: true,
});

export const insertHolidaySchema = createInsertSchema(holidays).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;

export type Payslip = typeof payslips.$inferSelect;
export type InsertPayslip = z.infer<typeof insertPayslipSchema>;

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export type LaborCostData = typeof laborCostData.$inferSelect;
export type InsertLaborCostData = z.infer<typeof insertLaborCostDataSchema>;

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

export type Break = typeof breaks.$inferSelect;
export type InsertBreak = z.infer<typeof insertBreakSchema>;

export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;