import { db } from "../../server/db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Helper to hash passwords (matching the auth implementation)
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seed() {
  console.log("------------------------------------------------");
  console.log("Seeding Users (Admin, Manager, Payroll, Employee)");
  console.log("------------------------------------------------");

  // Clear existing users to avoid conflicts
  // Note: This might fail if there are foreign key constraints (like attendance)
  // For a fresh seed, we usually ignore or rely on cascade, but here we'll try to delete specific usernames first
  await db.delete(users).where(eq(users.username, "admin"));
  await db.delete(users).where(eq(users.username, "manager"));
  await db.delete(users).where(eq(users.username, "payroll"));
  // We don't delete 'employee' by default to preserve the attendance records linked to that specific ID 
  // if you ran the previous scripts. We will use "on conflict do update" logic or just check existence.
  
  // Set common password for all users
  const defaultPassword = await hashPassword("qweqwe");

  // 1. Create Admin
  console.log("Creating Admin...");
  const [admin] = await db.insert(users).values({
    username: "admin",
    password: defaultPassword,
    email: "admin@company.com",
    firstName: "System",
    lastName: "Admin",
    role: "admin",
    department: "Administration",
    position: "Administrator",
    employeeId: "ADMIN-001",
    annualLeaveBalance: 20,
    sickLeaveBalance: 10,
  }).returning();

  // 2. Create Manager
  console.log("Creating Manager...");
  const [manager] = await db.insert(users).values({
    username: "manager",
    password: defaultPassword,
    email: "manager@company.com",
    firstName: "Maria",
    lastName: "Santos",
    role: "manager",
    department: "Operations",
    position: "Operations Manager",
    employeeId: "MGR-001",
    managerId: admin.id, // Reports to Admin
    annualLeaveBalance: 15,
    sickLeaveBalance: 10,
  }).returning();

  // 3. Create Payroll Officer
  console.log("Creating Payroll Officer...");
  await db.insert(users).values({
    username: "payroll",
    password: defaultPassword,
    email: "payroll@company.com",
    firstName: "Patricia",
    lastName: "Reyes",
    role: "payroll_officer",
    department: "Finance",
    position: "Payroll Officer",
    employeeId: "FIN-001",
    managerId: admin.id, // Reports to Admin
    annualLeaveBalance: 15,
    sickLeaveBalance: 10,
  });

  // 4. Create/Update Employee (Kevin Cruz)
  // We use the specific UUID to link with attendance data
  const KEVIN_ID = "ab20cde9-a834-4b49-bf93-2db071427cbc";
  console.log("Creating Employee (Kevin Cruz)...");
  
  // Check if Kevin exists to avoid duplicate key error on ID
  const existingKevin = await db.query.users.findFirst({
    where: eq(users.id, KEVIN_ID)
  });

  if (existingKevin) {
    console.log("Updating existing Kevin Cruz account...");
    await db.update(users).set({
      username: "employee",
      password: defaultPassword,
      firstName: "Kevin",
      lastName: "Cruz",
      role: "employee",
      managerId: manager.id, // Reports to Manager
      department: "Operations",
      position: "Cashier"
    }).where(eq(users.id, KEVIN_ID));
  } else {
    console.log("Inserting new Kevin Cruz account...");
    await db.insert(users).values({
      id: KEVIN_ID,
      username: "employee",
      password: defaultPassword,
      email: "employee@gmail.com",
      firstName: "Kevin",
      lastName: "Cruz",
      role: "employee",
      department: "Operations",
      position: "Cashier",
      employeeId: "EMP-001",
      managerId: manager.id, // Reports to Manager
      annualLeaveBalance: 15,
      sickLeaveBalance: 10,
      serviceIncentiveLeaveBalance: 5,
    });
  }

  console.log("------------------------------------------------");
  console.log("User Seeding Complete!");
  console.log("Credentials:");
  console.log(" - Admin: admin / qweqwe");
  console.log(" - Manager: manager / qweqwe");
  console.log(" - Payroll: payroll / qweqwe");
  console.log(" - Employee: employee / qweqwe");
  console.log("------------------------------------------------");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});