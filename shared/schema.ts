import { sql } from "drizzle-orm";
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
  emergencyLeaveBalance: integer("emergency_leave_balance").default(5),
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

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  uploadedAt: integer("uploaded_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
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

export const trainings = sqliteTable("trainings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"),
  startDate: integer("start_date", { mode: 'timestamp_ms' }),
  endDate: integer("end_date", { mode: 'timestamp_ms' }),
  duration: integer("duration"),
  isMandatory: integer("is_mandatory", { mode: 'boolean' }).default(false),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).$onUpdateFn(() => new Date()),
});

export const userTrainings = sqliteTable("user_trainings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  trainingId: text("training_id").notNull().references(() => trainings.id),
  status: text("status").default("not_started"),
  progress: integer("progress").default(0),
  completedAt: integer("completed_at", { mode: 'timestamp_ms' }),
  startedAt: integer("started_at", { mode: 'timestamp_ms' }),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), 
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").default("low"), 
  status: text("status").default("pending"), 
  location: text("location"),
  
  itemName: text("item_name"),
  itemQuantity: integer("item_quantity"),
  estimatedCost: integer("estimated_cost"),
  
  assignedTo: text("assigned_to").references(() => users.id),
  resolvedBy: text("resolved_by").references(() => users.id),
  resolvedAt: integer("resolved_at", { mode: 'timestamp_ms' }),
  notes: text("notes"),
  attachments: json<string[]>("attachments"),
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

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingSchema = createInsertSchema(trainings).omit({
  id: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserTrainingSchema = createInsertSchema(userTrainings).omit({
  id: true,
  status: true,
  progress: true,
  completedAt: true,
  startedAt: true,
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

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;

export type Payslip = typeof payslips.$inferSelect;
export type InsertPayslip = z.infer<typeof insertPayslipSchema>;

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type Training = typeof trainings.$inferSelect;
export type InsertTraining = z.infer<typeof insertTrainingSchema>;

export type UserTraining = typeof userTrainings.$inferSelect;
export type InsertUserTraining = z.infer<typeof insertUserTrainingSchema>;

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export type LaborCostData = typeof laborCostData.$inferSelect;
export type InsertLaborCostData = z.infer<typeof insertLaborCostDataSchema>;
