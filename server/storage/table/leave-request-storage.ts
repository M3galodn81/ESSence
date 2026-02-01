import { db, } from "../../db";
import { LeaveRequest, User, InsertLeaveRequest, leaveRequests } from "@shared/schema";
import { desc, eq, inArray} from "drizzle-orm";
import { BaseStorage } from "./base-storage";


export class LeaveRequestStorage extends BaseStorage{
async createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest> {
    const result = await db.insert(leaveRequests).values(request).returning();
    const leaveRequest = result[0];

    await this.createActivity({
      userId: request.userId,
      type: "leave_requested",
      description: `Leave request submitted for ${request.days} days`,
      metadata: { leaveRequestId: leaveRequest.id, startDate: request.startDate, endDate: request.endDate },
    });

    return leaveRequest;
  }

  async getLeaveRequestsByUser(userId: string): Promise<LeaveRequest[]> {
    return await db.select().from(leaveRequests)
      .where(eq(leaveRequests.userId, userId))
      .orderBy(desc(leaveRequests.createdAt));
  }

  async getLeaveRequestById(id: string): Promise<LeaveRequest | undefined> {
    const result = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
    return result[0];
  }

  async updateLeaveRequest(id: string, updates: Partial<LeaveRequest>): Promise<LeaveRequest | undefined> {
    const request = await this.getLeaveRequestById(id);
    if (!request) return undefined;

    const result = await db.update(leaveRequests).set(updates).where(eq(leaveRequests.id, id)).returning();
    const updatedRequest = result[0];

    if (updates.status && updates.status !== request.status) {
      await this.createActivity({
        userId: request.userId,
        type: updates.status === 'approved' ? 'leave_approved' : 'leave_rejected',
        description: `Leave request ${updates.status}`,
        metadata: { leaveRequestId: id },
      });

      if (updates.status === 'approved') {
        const user = await this.getUser(request.userId);
        if (user) {
          const leaveBalanceUpdates: Partial<User> = {};

          if (request.type === 'annual' || request.type === 'vacation') {
            leaveBalanceUpdates.annualLeaveBalance = (user.annualLeaveBalance || 15) - request.days;
          } else if (request.type === 'sick') {
            leaveBalanceUpdates.sickLeaveBalance = (user.sickLeaveBalance || 10) - request.days;
          } else if (request.type === 'emergency') {
            leaveBalanceUpdates.emergencyLeaveBalance = (user.emergencyLeaveBalance || 5) - request.days;
          }

          if (Object.keys(leaveBalanceUpdates).length > 0) {
            await this.updateUser(request.userId, leaveBalanceUpdates);
          }
        }
      }
    }

    return updatedRequest;
  }

  async getPendingLeaveRequests(managerId?: string): Promise<LeaveRequest[]> {
    let query = db.select().from(leaveRequests).where(eq(leaveRequests.status, 'pending'));

    if (managerId) {
      const teamMembers = await this.getUsersByManager(managerId);
      const teamMemberIds = teamMembers.map(member => member.id);
      query = query.where(inArray(leaveRequests.userId, teamMemberIds));
    }

    return await query.orderBy(desc(leaveRequests.createdAt));
  }
}