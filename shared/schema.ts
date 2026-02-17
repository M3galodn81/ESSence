import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- 1. Robust Types & Interfaces ---

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface Address {
  street: string;
  city: string;
  province: string;
  zipCode: string;
  country?: string;
}

export interface PayItems {
  name: string;
  amount: number; // in cents
}

// Helper to enforce types on JSON columns
const json = <T>(name: string) => {
  return text(name, { mode: 'json' }).$type<T>();
};

// --- 2. Users Table (Comprehensive HR Profile) ---
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // -- Auth & System --
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("employee"),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  profilePicture: text("profile_picture"),

  // -- Personal Information --
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  birthDate: integer("birth_date", { mode: 'timestamp_ms' }),
  gender: text("gender"),
  civilStatus: text("civil_status"),
  nationality: text("nationality"),
  phoneNumber: text("phone_number"),
  
  // -- Contact Info --
  address: json<Address>("address"),
  emergencyContact: json<EmergencyContact>("emergency_contact"),

  // -- Employment Details --
  employeeId: text("employee_id").unique(),
  department: text("department"),
  position: text("position"),
  employmentStatus: text("employment_status").default("regular"), // regular, probationary, contractual
  
  hireDate: integer("hire_date", { mode: 'timestamp_ms' }),
  inactiveDate: integer("inactive_date", { mode: 'timestamp_ms' }), // Date of separation
  
  salary: integer("salary"), // Stored in cents
  managerId: text("manager_id").references(() => users.id, { onDelete: "set null" }),
  
  // -- Leave Balances --
  annualLeaveBalance: integer("annual_leave_balance").default(15),
  sickLeaveBalance: integer("sick_leave_balance").default(10),
  serviceIncentiveLeaveBalance: integer("emergency_leave_balance").default(5),

  annualLeaveBalanceLimit: integer("annual_leave_balance_limit").default(15),
  sickLeaveBalanceLimit: integer("sick_leave_balance_limit").default(10),
  serviceIncentiveLeaveBalanceLimit: integer("emergency_leave_balance_limit").default(5),

  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
}, (table) => ({
  roleIdx: index("role_idx").on(table.role),
  deptIdx: index("dept_idx").on(table.department),
  managerIdx: index("manager_idx").on(table.managerId),
  lastNameIdx: index("lastname_idx").on(table.lastName),
}));

// --- 3. Leave Requests (Expanded) ---
export const leaveRequests = sqliteTable("leave_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  type: text("type").notNull(), // annual, sick, unpaid, maternity, etc.
  startDate: integer("start_date", { mode: 'timestamp_ms' }).notNull(),
  endDate: integer("end_date", { mode: 'timestamp_ms' }).notNull(),
  
  dayType: text("day_type").default("whole"), // whole, half_am, half_pm
  days: integer("days").notNull(), // Can be 0.5 for half days
  
  reason: text("reason"),
  attachmentUrl: text("attachment_url"), // For medical certificates
  
  status: text("status").default("pending"),
  rejectionReason: text("rejection_reason"),
  
  approvedBy: text("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: integer("approved_at", { mode: 'timestamp_ms' }),
  
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
}, (table) => ({
  userRequestIdx: index("user_request_idx").on(table.userId),
  statusIdx: index("status_idx").on(table.status),
}));

// --- 4. Payslips (Expanded Financials) ---
export const payslips = sqliteTable("payslips", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  period: integer("period").notNull().default(1), // 1 (1st-15th) or 2 (16th-End)
  
  // -- Earnings --
  basicSalary: integer("basic_salary").notNull(),
  overtimePay: integer("overtime_pay").default(0),
  holidayPay: integer("holiday_pay").default(0),
  nightDiffPay: integer("night_diff_pay").default(0),
  allowances: json<PayItems[]>("allowances"), // JSON for flexible allowances (Rice, Laundry, etc)
  
  // -- Deductions (Explicit Columns for Reporting) --
  sssContribution: integer("sss_contribution").default(0),
  philHealthContribution: integer("philhealth_contribution").default(0),
  pagIbigContribution: integer("pagibig_contribution").default(0),
  withholdingTax: integer("withholding_tax").default(0),
  otherDeductions: json<PayItems[]>("other_deductions"), // Loans, Late deductions
  
  grossPay: integer("gross_pay").notNull(),
  totalDeductions: integer("total_deductions").notNull(),
  netPay: integer("net_pay").notNull(),
  
  paymentStatus: text("payment_status").default("draft"), // draft, finalized, paid
  paymentDate: integer("payment_date", { mode: 'timestamp_ms' }),
  
  generatedAt: integer("generated_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  userPayslipIdx: index("user_payslip_idx").on(table.userId),
  periodIdx: index("period_idx").on(table.userId, table.month, table.year),
}));

// --- 5. Schedules (Expanded Shift Details) ---
export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  date: integer("date", { mode: 'timestamp_ms' }).notNull(),
  startTime: integer("start_time", { mode: 'timestamp_ms' }).notNull(),
  endTime: integer("end_time", { mode: 'timestamp_ms' }).notNull(),
  
  shiftName: text("shift_name"), // e.g. "Morning Shift", "Graveyard"
  type: text("type").notNull(), // regular, overtime, training
  
  location: text("location"), // "Main Office", "Site B"
  isRemote: integer("is_remote", { mode: 'boolean' }).default(false),
  
  gracePeriodMinutes: integer("grace_period_minutes").default(15),
  breakDurationMinutes: integer("break_duration_minutes").default(60),
  
  status: text("status").default("published"), // draft, published, cancelled
  
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
}, (table) => ({
  userScheduleIdx: index("user_schedule_idx").on(table.userId),
  dateIdx: index("schedule_date_idx").on(table.date),
}));

// --- 6. Holidays (Expanded) ---
export const holidays = sqliteTable("holidays", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  date: integer("date", { mode: 'timestamp_ms' }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'regular', 'special_non_working'
  
  description: text("description"),
  isPaid: integer("is_paid", { mode: 'boolean' }).default(true),
  payRateMultiplier: integer("pay_rate_multiplier").default(100), // 100%, 200%, etc.
  
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  holidayDateIdx: index("holiday_date_idx").on(table.date),
}));

// --- 7. Announcements (Expanded Targeting) ---
export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  
  type: text("type").default("general"), // general, urgent, policy, event
  priority: text("priority").default("normal"), // low, normal, high
  
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  targetDepartments: json<string[]>("target_departments"), // ["IT", "HR"] or null for all
  targetRoles: json<string[]>("target_roles"), // ["manager"] or null for all
  
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  expiresAt: integer("expires_at", { mode: 'timestamp_ms' }),
  
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
});

// --- 8. Activities (Expanded Audit Trail) ---
export const activities = sqliteTable("activities", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), 
  
  type: text("type").notNull(), // login, create_user, approve_leave
  category: text("category").default("system"), // system, security, hr
  
  entityType: text("entity_type"), // 'user', 'report'
  entityId: text("entity_id"),
  
  details: text("details"),
  metadata: json<Record<string, any>>("metadata"), // Store extra context (e.g. old vs new values)
  
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  activityUserIdx: index("activity_user_idx").on(table.userId),
  activityDateIdx: index("activity_date_idx").on(table.createdAt),
}));

// --- 9. Reports (Incident Management) ---
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  category: text("category").notNull(), // accident, disciplinary, dispute
  title: text("title").notNull(),
  description: text("description").notNull(),
  
  severity: text("severity").default("low"), 
  status: text("status").default("pending"), // pending, investigation, resolved, closed
  location: text("location").notNull(),

  dateOccurred: integer("date_occurred", { mode: 'timestamp_ms' }).notNull(),
  timeOccurred: text("time_occurred").notNull(),
  partiesInvolved: text("parties_involved"), 
  witnesses: text("witnesses"), 
  actionTaken: text("action_taken"), 
  
  details: json<Record<string, any>>("details"),
  images: json<string[]>("images"), 

  // -- Disciplinary specifics --
  nteRequired: integer("nte_required", { mode: 'boolean' }).default(false),
  nteContent: text("nte_content"),
  assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }), // Who needs to explain
  
  resolvedBy: text("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: integer("resolved_at", { mode: 'timestamp_ms' }),
  
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
}, (table) => ({
  reportUserIdx: index("report_user_idx").on(table.userId),
  reportStatusIdx: index("report_status_idx").on(table.status),
}));

// --- 10. Labor Cost Data (Expanded Analytics) ---
export const laborCostData = sqliteTable("labor_cost_data", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  
  totalSales: integer("total_sales").notNull(),
  totalLaborCost: integer("total_labor_cost").notNull(),
  laborCostPercentage: integer("labor_cost_percentage").notNull(),
  
  targetSales: integer("target_sales"), // Added for comparison
  budgetedLaborCost: integer("budgeted_labor_cost"),
  
  status: text("status"),
  performanceRating: text("performance_rating"),
  notes: text("notes"),
  
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
}, (table) => ({
  uniqueMonth: unique().on(table.month, table.year),
}));

// --- 11. Attendance (Geofencing & Accuracy) ---
export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: integer("date", { mode: 'timestamp_ms' }).notNull(),
  
  timeIn: integer("time_in", { mode: 'timestamp_ms' }).notNull(),
  timeOut: integer("time_out", { mode: 'timestamp_ms' }),
  
  clockInDevice: text("clock_in_device"),
  clockOutDevice: text("clock_out_device"),
  
  status: text("status").default("clocked_in"), // clocked_in, clocked_out, absent, leave
  
  // Calculated metrics
  isLate: integer("is_late", { mode: 'boolean' }).default(false),
  lateMinutes: integer("late_minutes").default(0),
  isUndertime: integer("is_undertime", { mode: 'boolean' }).default(false),
  undertimeMinutes: integer("undertime_minutes").default(0),
  overtimeMinutes: integer("overtime_minutes").default(0),
  
  totalBreakMinutes: integer("total_break_minutes").default(0),
  totalWorkMinutes: integer("total_work_minutes"),
  
  notes: text("notes"),
  
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
}, (table) => ({
  attUserIdx: index("att_user_idx").on(table.userId),
  attDateIdx: index("att_date_idx").on(table.date),
}));

// --- 12. Breaks (Unchanged but robust) ---
export const breaks = sqliteTable("breaks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  attendanceId: text("attendance_id").notNull().references(() => attendance.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  breakStart: integer("break_start", { mode: 'timestamp_ms' }).notNull(),
  breakEnd: integer("break_end", { mode: 'timestamp_ms' }),
  breakMinutes: integer("break_minutes"),
  breakType: text("break_type").default("regular"), 
  notes: text("notes"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  breakAttIdx: index("break_att_idx").on(table.attendanceId),
}));

// --- 13. Announcement Reads (Unchanged) ---
export const announcementReads = sqliteTable("announcement_reads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  announcementId: text("announcement_id").notNull().references(() => announcements.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: integer("read_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  uniqueRead: unique().on(table.announcementId, table.userId),
}));

// --- Zod Schemas ---

export const insertAnnouncementReadSchema = createInsertSchema(announcementReads);
export type AnnouncementRead = typeof announcementReads.$inferSelect;
export type InsertAnnouncementRead = typeof announcementReads.$inferInsert;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true, status: true, approvedBy: true, approvedAt: true, createdAt: true, updatedAt: true,
});

export const insertPayslipSchema = createInsertSchema(payslips).omit({
  id: true, generatedAt: true,
});

// Manual Schema for API Validation (since schedule table has specific logic)
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
  id: true, createdAt: true, updatedAt: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true, createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports, {
  dateOccurred: z.number(),
  nteRequired: z.boolean().optional(),
}).omit({
  id: true,
  status: true,
  resolvedBy: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLaborCostDataSchema = createInsertSchema(laborCostData).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true, status: true, totalBreakMinutes: true, totalWorkMinutes: true, createdAt: true, updatedAt: true,
});

export const insertBreakSchema = createInsertSchema(breaks).omit({
  id: true, breakMinutes: true, createdAt: true,
});

export const insertHolidaySchema = createInsertSchema(holidays).omit({
  id: true, createdAt: true,
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