import { db } from "../../db";
import { Report, reports, InsertReport } from "@shared/schema";
import { or, desc, eq } from "drizzle-orm";
import { BaseStorage } from "./base-storage";

export class ReportStorage extends BaseStorage {
 async createReport(report: InsertReport): Promise<Report> {
    const result = await db.insert(reports).values(report).returning();
    const newReport = result[0];

    await this.createActivity({
      userId: report.userId,
      type: "report_created",
      category: "hr",
      entityType: "report",
      entityId: newReport.id,
      details: `${(report.category)?.toUpperCase()} report submitted: ${report.title}`,
      metadata: { severity: report.severity, status: newReport.status },
    });

    return newReport;
  }

  async getReportsByUser(userId: string): Promise<Report[]> {
    const result = await db.select().from(reports)
      .where(or(eq(reports.userId, userId), eq(reports.assignedTo, userId)))
      .orderBy(desc(reports.createdAt));
      
    return result;
  }

  async getAllReports(): Promise<Report[]> {
    return await db.select().from(reports).orderBy(desc(reports.createdAt));
  }

  async getReportById(id: string): Promise<Report | undefined> {
    const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    return result[0];
  }

  async updateReport(id: string, updates: Partial<Report>): Promise<Report | undefined> {
    const result = await db.update(reports).set(updates).where(eq(reports.id, id)).returning();
    
    if (result[0]) {
       await this.createActivity({
         userId: result[0].userId,
         type: "report_updated",
         category: "hr",
         entityType: "report",
         entityId: id,
         details: `Incident report updated to status: ${updates.status || result[0].status}`,
         metadata: updates,
       });
    }

    return result[0];
  }
}