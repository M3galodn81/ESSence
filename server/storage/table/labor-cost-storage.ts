import { db, } from "../../db";
import { LaborCostData, laborCostData, InsertLaborCostData } from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { BaseStorage } from "./base-storage";

export class LaborCostStorage extends BaseStorage{
async createLaborCostData(data: InsertLaborCostData): Promise<LaborCostData> {
    const result = await db.insert(laborCostData).values(data).returning();
    return result[0];
  }

  async getLaborCostData(year?: number): Promise<LaborCostData[]> {
    if (year) {
      return await db.select().from(laborCostData)
        .where(eq(laborCostData.year, year))
        .orderBy(desc(laborCostData.month));
    }
    return await db.select().from(laborCostData)
      .orderBy(desc(laborCostData.year), desc(laborCostData.month));
  }

  async getLaborCostDataByMonth(month: number, year: number): Promise<LaborCostData | undefined> {
    const result = await db.select().from(laborCostData)
      .where(and(eq(laborCostData.month, month), eq(laborCostData.year, year)))
      .limit(1);
    return result[0];
  }

  async updateLaborCostData(id: string, updates: Partial<LaborCostData>): Promise<LaborCostData | undefined> {
    const result = await db.update(laborCostData)
      .set(updates)
      .where(eq(laborCostData.id, id))
      .returning();
    return result[0];
  }
}