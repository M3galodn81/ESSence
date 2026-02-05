import { db, } from "../../db";
import { Payslip, payslips } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { BaseStorage } from "./base-storage";

export class PayslipStorage extends BaseStorage{
  async createPayslip(payslip: Omit<Payslip, 'id' | 'generatedAt'>): Promise<Payslip> {
    const result = await db.insert(payslips).values(payslip).returning();
    return result[0];
  }

  async getAllPayslips(): Promise<Payslip[]> {
    // FIX: Explicit select to avoid "no such column: period" error if DB is outdated
    return await db.select({
        id: payslips.id,
        userId: payslips.userId,
        month: payslips.month,
        year: payslips.year,
        period: payslips.period,
        basicSalary: payslips.basicSalary,
        allowances: payslips.allowances,
        deductions: payslips.deductions,
        grossPay: payslips.grossPay,
        netPay: payslips.netPay,
        generatedAt: payslips.generatedAt
    }).from(payslips)
      .orderBy(desc(payslips.generatedAt)) as unknown as Payslip[];
  }

  async getPayslipsByUser(userId: string): Promise<Payslip[]> {
    // FIX: Explicit select to avoid "no such column: period" error if DB is outdated
    return await db.select({
        id: payslips.id,
        userId: payslips.userId,
        month: payslips.month,
        year: payslips.year,
        period: payslips.period,
        basicSalary: payslips.basicSalary,
        allowances: payslips.allowances,
        deductions: payslips.deductions,
        grossPay: payslips.grossPay,
        netPay: payslips.netPay,
        generatedAt: payslips.generatedAt

    }).from(payslips)
      .where(eq(payslips.userId, userId))
      .orderBy(desc(payslips.generatedAt)) as unknown as Payslip[];
  }

  async getPayslipById(id: string): Promise<Payslip | undefined> {
    const result = await db.select().from(payslips).where(eq(payslips.id, id)).limit(1);
    return result[0];
  }
}