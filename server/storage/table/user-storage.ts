import { db } from "../../db";
import { users, User, InsertUser } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { BaseStorage } from "../table/base-storage";

export class UserStorage extends BaseStorage{
   async getUser(id: string): Promise<User | undefined> {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    }
  
    async getUserByUsername(username: string): Promise<User | undefined> {
      const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return result[0];
    }
  
    async getAllUsers(): Promise<User[]> {
      return await db.select().from(users);
    }

    async getAllEmployees(): Promise<User[]> {
      return await db.select().from(users).where(eq(users.role, 'employee'));
    }
  
    async createUser(insertUser: InsertUser, userId?: string): Promise<User> {
      const result = await db.insert(users).values(insertUser).returning();
  
      await this.createActivity({
        userId: userId || result[0].id,
        type: "user_created",
        description: `User ${insertUser.firstName} ${insertUser.lastName} created`,
      });
  
      return result[0];
    }
  
    async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
      const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
      return result[0];
    }
  
    async deleteUser(id: string): Promise<boolean> {
      await db.delete(users).where(eq(users.id, id));
      return true;
    }
  
    async getUsersByDepartment(department: string): Promise<User[]> {
      return await db.select().from(users).where(eq(users.department, department));
    }
  
    async getUsersByManager(managerId: string): Promise<User[]> {
      return await db.select().from(users).where(eq(users.managerId, managerId));
    }
  
    async getEmployeesForManager(managerId: string): Promise<User[]> {
      return await db.select().from(users).where(
          and(
              eq(users.role, 'employee'),
              eq(users.managerId, managerId) 
          )
      );
  }
}