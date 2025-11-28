import { db } from "../../server/db";
import { 
  users, holidays, announcements, leaveRequests, 
  schedules, reports, laborCostData, attendance, 
  breaks, activities, payslips
} from "../../shared/schema";
import { hashPassword } from "../../server/auth";

async function seed() {
  console.log("Starting database seeding...");

  // 1. Clean tables (Delete in reverse order of dependency)
  console.log("Cleaning existing data...");
  await db.delete(breaks);
  await db.delete(attendance);
  await db.delete(laborCostData);
  await db.delete(reports);
  await db.delete(activities);
  await db.delete(announcements);
  await db.delete(schedules);
  await db.delete(payslips);
  await db.delete(leaveRequests);
  await db.delete(holidays);
  await db.delete(users);

  // 2. Create Users
  console.log("Creating users...");
  const password = await hashPassword("qweqwe"); // Default password for all

  // Admin
  const [admin] = await db.insert(users).values({
    username: "admin",
    password,
    email: "admin@essence.com",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    department: "IT",
    position: "System Administrator",
    employeeId: "ADM-001",
    hireDate: new Date("2023-01-01"),
    salary: 8000000, // 80k
    isActive: true
  }).returning();

  // Manager
  const [manager] = await db.insert(users).values({
    username: "manager",
    password,
    email: "manager@essence.com",
    firstName: "Sarah",
    lastName: "Connor",
    role: "manager",
    department: "Operations",
    position: "Operations Manager",
    employeeId: "MAN-001",
    hireDate: new Date("2023-02-01"),
    salary: 6000000, // 60k
    isActive: true
  }).returning();

  // Payroll Officer
  const [payroll] = await db.insert(users).values({
    username: "payroll",
    password,
    email: "payroll@essence.com",
    firstName: "Penny",
    lastName: "Roll",
    role: "payroll_officer",
    department: "Finance",
    position: "Payroll Specialist",
    employeeId: "PAY-001",
    hireDate: new Date("2023-03-01"),
    salary: 4500000, // 45k
    isActive: true
  }).returning();

  // Employees
  const [emp1] = await db.insert(users).values({
    username: "john",
    password,
    email: "john.doe@essence.com",
    firstName: "John",
    lastName: "Doe",
    role: "employee",
    department: "Operations",
    position: "Server",
    employeeId: "EMP-001",
    managerId: manager.id,
    hireDate: new Date("2024-01-15"),
    salary: 2500000, // 25k
    isActive: true,
    annualLeaveBalance: 15,
    sickLeaveBalance: 10
  }).returning();

  const [emp2] = await db.insert(users).values({
    username: "jane",
    password,
    email: "jane.smith@essence.com",
    firstName: "Jane",
    lastName: "Smith",
    role: "employee",
    department: "Kitchen",
    position: "Chef",
    employeeId: "EMP-002",
    managerId: manager.id,
    hireDate: new Date("2024-02-20"),
    salary: 3000000, // 30k
    isActive: true,
    annualLeaveBalance: 12,
    sickLeaveBalance: 8
  }).returning();

  // 3. Holidays
  console.log("Creating holidays...");
  await db.insert(holidays).values([
    { name: "New Year's Day", date: new Date("2025-01-01"), type: "regular" },
    { name: "Labor Day", date: new Date("2025-05-01"), type: "regular" },
    { name: "Independence Day", date: new Date("2025-06-12"), type: "regular" },
    { name: "Ninoy Aquino Day", date: new Date("2025-08-21"), type: "special" },
    { name: "Christmas Day", date: new Date("2025-12-25"), type: "regular" },
    { name: "Rizal Day", date: new Date("2025-12-30"), type: "regular" },
  ]);

  // 4. Announcements
  console.log("Creating announcements...");
  await db.insert(announcements).values([
    {
      title: "Welcome to ESSence",
      content: "We are excited to introduce our new Employee Self-Service portal. Please update your profiles.",
      type: "general",
      authorId: admin.id,
      isActive: true,
      targetDepartments: [],
      createdAt: new Date()
    },
    {
      title: "Holiday Schedule Update",
      content: "Please note the updated holiday schedule for December. Operations will run on a skeletal workforce.",
      type: "urgent",
      authorId: admin.id,
      isActive: true,
      targetDepartments: ["Operations", "Kitchen"],
      createdAt: new Date(Date.now() - 86400000) // 1 day ago
    },
    {
      title: "New HR Policy",
      content: "Updated guidelines on remote work eligibility are now available in the documents section.",
      type: "policy",
      authorId: manager.id,
      isActive: true,
      targetDepartments: [],
      createdAt: new Date(Date.now() - 172800000) // 2 days ago
    }
  ]);

  // 5. Schedules (Current Week)
  console.log("Creating schedules...");
  const today = new Date();
  const startOfWeek = new Date(today);
  const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const shifts = [];
  
  // Generate shifts for Mon-Fri for both employees
  for (let i = 0; i < 5; i++) { 
    const shiftDate = new Date(startOfWeek);
    shiftDate.setDate(startOfWeek.getDate() + i);
    
    // Skip if date is in the past (optional, but good for "upcoming" schedule view)
    
    // Emp1: Morning Shift (8am - 4pm)
    const start1 = new Date(shiftDate); start1.setHours(8, 0, 0, 0);
    const end1 = new Date(shiftDate); end1.setHours(16, 0, 0, 0);
    
    shifts.push({
      userId: emp1.id,
      date: shiftDate,
      startTime: start1,
      endTime: end1,
      type: "morning",
      title: "Morning Shift",
      shiftRole: "server",
      location: "Main Hall"
    });

    // Emp2: Afternoon Shift (4pm - 12am)
    const start2 = new Date(shiftDate); start2.setHours(16, 0, 0, 0);
    const end2 = new Date(shiftDate); 
    end2.setDate(shiftDate.getDate() + 1); // Next day
    end2.setHours(0, 0, 0, 0);

    shifts.push({
      userId: emp2.id,
      date: shiftDate,
      startTime: start2,
      endTime: end2,
      type: "afternoon",
      title: "Afternoon Shift",
      shiftRole: "kitchen",
      location: "Kitchen"
    });
  }
  await db.insert(schedules).values(shifts);

  // 6. Attendance & Breaks (Historical Data for Analytics)
  console.log("Creating attendance history...");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0,0,0,0);

  // Emp1 worked yesterday (8:00 AM - 5:00 PM)
  const timeIn1 = new Date(yesterday); timeIn1.setHours(7, 55, 0, 0); // Early in
  const timeOut1 = new Date(yesterday); timeOut1.setHours(17, 5, 0, 0); // Late out
  
  const [att1] = await db.insert(attendance).values({
    userId: emp1.id,
    date: yesterday,
    timeIn: timeIn1,
    timeOut: timeOut1,
    status: "clocked_out",
    totalBreakMinutes: 60,
    totalWorkMinutes: 540, // 9 hours total - 1 hr break = 8 hrs
    notes: "Regular shift"
  }).returning();

  await db.insert(breaks).values({
    attendanceId: att1.id,
    userId: emp1.id,
    breakStart: new Date(yesterday.setHours(12, 0, 0)),
    breakEnd: new Date(yesterday.setHours(13, 0, 0)),
    breakMinutes: 60,
    breakType: "lunch",
    notes: "Lunch break"
  });

  // 7. Leave Requests
  console.log("Creating leave requests...");
  await db.insert(leaveRequests).values([
    {
      userId: emp1.id,
      type: "annual",
      startDate: new Date("2025-12-01"),
      endDate: new Date("2025-12-05"),
      days: 5,
      reason: "Family vacation to Boracay",
      status: "pending",
      createdAt: new Date()
    },
    {
      userId: emp2.id,
      type: "sick",
      startDate: new Date("2025-10-10"),
      endDate: new Date("2025-10-11"),
      days: 2,
      reason: "Flu",
      status: "approved",
      approvedBy: manager.id,
      approvedAt: new Date("2025-10-09"),
      createdAt: new Date("2025-10-09")
    }
  ]);

  // 8. Labor Cost Data (For Analytics Chart)
  console.log("Creating analytics data...");
  const currentYear = new Date().getFullYear();
  await db.insert(laborCostData).values([
    {
      month: 9, // September
      year: currentYear,
      totalSales: 12500000, // 125k
      totalLaborCost: 2500000, // 25k
      laborCostPercentage: 2000, // 20%
      status: "Excellent",
      performanceRating: "good",
      notes: "Strong sales month"
    },
    {
      month: 10, // October
      year: currentYear,
      totalSales: 12500000,
      totalLaborCost: 1200000,
      laborCostPercentage: 960, // 9.6%
      status: "Excellent",
      performanceRating: "good",
      notes: "Efficient labor usage"
    },
    {
      month: 11, // November (Current/Recent)
      year: currentYear,
      totalSales: 8500000, // Lower sales
      totalLaborCost: 2800000, // Higher cost
      laborCostPercentage: 3294, // ~33%
      status: "High",
      performanceRating: "warning",
      notes: "Seasonal dip"
    }
  ]);

  // 9. Incident Reports
  console.log("Creating reports...");
  await db.insert(reports).values([
    {
      userId: emp1.id,
      type: "incident",
      title: "Slippery Floor",
      description: "Water spill near the kitchen entrance caused a near-miss slip.",
      severity: "high",
      status: "investigating",
      location: "Kitchen Entrance",
      createdAt: new Date()
    },
    {
      userId: emp2.id,
      type: "breakage",
      title: "Broken Plates",
      description: "Stack of plates fell during rush hour.",
      severity: "low",
      status: "resolved",
      location: "Dishwashing Area",
      itemName: "Dinner Plate",
      itemQuantity: 5,
      estimatedCost: 25000, // 250 pesos
      resolvedBy: manager.id,
      resolvedAt: new Date(),
      createdAt: new Date(Date.now() - 86400000)
    }
  ]);

  // 10. Recent Activities
  console.log("Creating activity logs...");
  await db.insert(activities).values([
    {
      userId: emp1.id,
      type: "clock_in",
      entityType: "attendance",
      entityId: att1.id,
      details: { action: "clock_in", userName: "John Doe" },
      createdAt: new Date(Date.now() - 100000000)
    },
    {
      userId: manager.id,
      type: "leave_approved",
      entityType: "leave_request",
      details: { action: "approve", userName: "Sarah Connor" },
      createdAt: new Date(Date.now() - 5000000)
    }
  ]);

  console.log("Seed completed successfully!");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});