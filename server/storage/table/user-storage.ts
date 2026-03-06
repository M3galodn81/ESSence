import { db } from "../../db";
import { users, User, InsertUser } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { BaseStorage } from "../table/base-storage";

export class UserStorage extends BaseStorage {
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
        category: "hr",
        entityType: "user",
        entityId: result[0].id,
        details: `User ${insertUser.firstName} ${insertUser.lastName} created`,
        metadata: { 
          role: insertUser.role, 
          email: insertUser.email,
          department: insertUser.department,
          position: insertUser.position 
        },
      });
  
      return result[0];
    }
  
    async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
      const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
      
      if (result[0]) {
        await this.createActivity({
          userId: id, 
          type: "user_updated",
          category: "hr",
          entityType: "user",
          entityId: id,
          details: `User profile updated for ${result[0].firstName}`,
          metadata: {
            updatedFields: Object.keys(updates), // Track exactly which fields were changed
            ...updates // Log the new values
          },
        });
      }

      return result[0];
    }
  
    async deleteUser(id: string, deletedBy?: string): Promise<boolean> {
      // 1. Fetch user details before they are permanently deleted
      const userToDelete = await this.getUser(id);
      const name = userToDelete ? `${userToDelete.firstName} ${userToDelete.lastName}` : id;

      // 2. Delete the user
      await db.delete(users).where(eq(users.id, id));

      // 3. Log the deletion against the ADMIN (deletedBy) to prevent cascade wipe
      if (deletedBy) {
        await this.createActivity({ 
          userId: deletedBy, 
          type: "user_deleted", 
          category: "security",
          entityType: "user", 
          entityId: id, 
          details: `Deleted user account: ${name}`,
          metadata: { 
            deletedUserId: id, 
            role: userToDelete?.role,
            email: userToDelete?.email,
            department: userToDelete?.department 
          }
        });
      }

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