import { db, } from "../../db";
import { Report, reports, InsertReport,  } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { BaseStorage } from "./base-storage";

export class ReportStorage extends BaseStorage{
 async createReport(report: InsertReport): Promise<Report> {
    const result = await db.insert(reports).values(report).returning();
    const newReport = result[0];

    await this.createActivity({
      userId: report.userId,
      type: "report_created",
      description: `${report.type === 'incident' ? 'Incident' : 'Breakage'} report submitted: ${report.title}`,
      metadata: { reportId: newReport.id, reportType: report.type },
    });

    return newReport;
  }

  async getReportsByUser(userId: string): Promise<Report[]> {
    return await db.select().from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(desc(reports.createdAt));
  }

  async getAllReports(): Promise<Report[]> {
    return await db.select().from(reports)
      .orderBy(desc(reports.createdAt));
  }

  async getReportById(id: string): Promise<Report | undefined> {
    const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    return result[0];
  }

  async updateReport(id: string, updates: Partial<Report>): Promise<Report | undefined> {
    const result = await db.update(reports)
      .set(updates)
      .where(eq(reports.id, id))
      .returning();
    return result[0];
  }
}