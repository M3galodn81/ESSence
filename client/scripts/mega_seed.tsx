import { db } from "../../server/db";
import { 
  users, holidays, announcements, leaveRequests, 
  schedules, reports, laborCostData, attendance, 
  breaks, activities, payslips
} from "../../shared/schema";
import { hashPassword } from "../../server/auth";

// --- TOGGLE FEATURES ---
const SHOW_HOLIDAY_FEATURES = true; 

// --- Constants & Helpers ---
const HOURLY_RATE = 58.75;
const OT_MULTIPLIER = 1.25;
const ND_MULTIPLIER = 1.1;

// Holiday Rates
const REG_HOLIDAY_MULTIPLIER = 2.0;
const REG_HOLIDAY_OT_MULTIPLIER = 2.5;
const SPL_HOLIDAY_MULTIPLIER = 1.3;
const SPL_HOLIDAY_OT_MULTIPLIER = 1.63;

// SSS Contribution Table (Simplified 2025)
const sssBrackets = [
  { min: 0,        max: 5249.99,  ms: 5000,  ee: 250 },
  { min: 5250,     max: 5749.99,  ms: 5500,  ee: 275 },
  { min: 5750,     max: 6249.99,  ms: 6000,  ee: 300 },
  { min: 6250,     max: 6749.99,  ms: 6500,  ee: 325 },
  { min: 6750,     max: 7249.99,  ms: 7000,  ee: 350 },
  { min: 7250,     max: 7749.99,  ms: 7500,  ee: 375 },
  { min: 7750,     max: 8249.99,  ms: 8000,  ee: 400 },
  { min: 8250,     max: 8749.99,  ms: 8500,  ee: 425 },
  { min: 8750,     max: 9249.99,  ms: 9000,  ee: 450 },
  { min: 9250,     max: 9749.99,  ms: 9500,  ee: 475 },
  { min: 9750,     max: 10249.99, ms: 10000, ee: 500 },
  { min: 10250,    max: 10749.99, ms: 10500, ee: 525 },
  { min: 10750,    max: 11249.99, ms: 11000, ee: 550 },
  { min: 11250,    max: 11749.99, ms: 11500, ee: 575 },
  { min: 11750,    max: 12249.99, ms: 12000, ee: 600 },
  { min: 12250,    max: 12749.99, ms: 12500, ee: 625 },
  { min: 12750,    max: 13249.99, ms: 13000, ee: 650 },
  { min: 13250,    max: 13749.99, ms: 13500, ee: 675 },
  { min: 13750,    max: 14249.99, ms: 14000, ee: 700 },
  { min: 14250,    max: 14749.99, ms: 14500, ee: 725 },
  { min: 14750,    max: 15249.99, ms: 15000, ee: 750 },
  { min: 15250,    max: 15749.99, ms: 15500, ee: 775 },
  { min: 15750,    max: 16249.99, ms: 16000, ee: 800 },
  { min: 16250,    max: 16749.99, ms: 16500, ee: 825 },
  { min: 16750,    max: 17249.99, ms: 17000, ee: 850 },
  { min: 17250,    max: 17749.99, ms: 17500, ee: 875 },
  { min: 17750,    max: 18249.99, ms: 18000, ee: 900 },
  { min: 18250,    max: 18749.99, ms: 18500, ee: 925 },
  { min: 18750,    max: 19249.99, ms: 19000, ee: 950 },
  { min: 19250,    max: 19749.99, ms: 19500, ee: 975 },
  { min: 19750,    max: 34749.99, ms: 20000, ee: 1000 }
];

const computeSSS = (grossSalary: number) => {
  const bracket = sssBrackets.find(b => grossSalary >= b.min && grossSalary <= b.max);
  if (!bracket) return 1000;
  return bracket.ee;
};

const computePagIbig = (basic: number) => {
  const rate = basic <= 1500 ? 0.01 : 0.02;
  const capped = Math.min(basic, 10000);
  return capped * rate;
};

const computePhilHealth = (basic: number) => {
  let income = basic;
  if (income < 10000) income = 10000;
  if (income > 100000) income = 100000;
  return (income * 0.05) / 2;
};

const getNightDiffHours = (timeIn: Date, timeOut: Date) => {
  let start = new Date(timeIn);
  let end = new Date(timeOut);
  let ndHours = 0;
  let current = new Date(start);
  current.setMinutes(0, 0, 0); 
  if (current.getTime() < start.getTime()) current.setHours(current.getHours() + 1);

  while (current.getTime() < end.getTime()) {
      const h = current.getHours();
      // Night Diff: 10PM (22) to 6AM (6)
      if (h >= 22 || h < 6) ndHours += 1;
      current.setHours(current.getHours() + 1);
  }
  return ndHours;
};

const getHolidayType = (date: Date, holidayList: any[]) => {
    const dStr = date.toISOString().split('T')[0];
    const holiday = holidayList.find(h => h.date.toISOString().split('T')[0] === dStr);
    return holiday ? holiday.type : null;
};

// --- NEW HELPER: Map Job Titles to "cashier", "bar", "server", "kitchen" ---
const mapPositionToShiftRole = (position: string): string => {
    const pos = position.toLowerCase();
    
    if (pos.includes("cook") || pos.includes("chef") || pos.includes("dishwasher")) {
        return "kitchen";
    }
    if (pos.includes("bartender")) {
        return "bar";
    }
    if (pos.includes("cashier")) {
        return "cashier";
    }
    // Default Hosts and Servers to "server"
    if (pos.includes("server") || pos.includes("host") || pos.includes("waiter")) {
        return "server";
    }
    
    return "server"; // Fallback
};

// --- SHIFT GENERATOR HELPER ---
const getRandomShift = (role: string, date: Date) => {
    const rand = Math.random();
    let type = "morning";
    let startHour = 8;
    
    // Logic: Customize probabilities based on granular role
    if (role === "Bartender") {
        if (rand < 0.1) { type = "morning"; startHour = 8; }
        else if (rand < 0.7) { type = "afternoon"; startHour = 16; } 
        else { type = "night"; startHour = 0; } 
    } else if (role === "Prep Cook" || role === "Dishwasher") {
        if (rand < 0.7) { type = "morning"; startHour = 7; } 
        else { type = "afternoon"; startHour = 15; } 
    } else {
        if (rand < 0.4) { type = "morning"; startHour = 8; }
        else if (rand < 0.8) { type = "afternoon"; startHour = 16; }
        else { type = "night"; startHour = 0; } 
    }

    const start = new Date(date);
    start.setHours(startHour, 0, 0, 0);

    const end = new Date(date);
    if (type === "morning") {
        end.setHours(startHour + 8, 0, 0, 0);
    } else if (type === "afternoon") {
        if (startHour + 8 >= 24) {
            end.setHours((startHour + 8) - 24, 0, 0, 0);
            end.setDate(end.getDate() + 1);
        } else {
            end.setHours(startHour + 8, 0, 0, 0);
        }
    } else if (type === "night") {
        end.setHours(startHour + 8, 0, 0, 0);
    }

    return { type, start, end };
};

// --- Dummy Data for New Columns ---
const dummyAddress = {
    street: "123 Main St",
    city: "Metro Manila",
    province: "NCR",
    zipCode: "1000",
    country: "Philippines"
};

const dummyEmergencyContact = {
    name: "Juan Dela Cruz",
    relation: "Father",
    phone: "0917-123-4567"
};

async function seed() {
  console.log("Starting database seeding...");

  // 1. Clean tables
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
  const password = await hashPassword("qweqwe"); 

  // Admin
  const [admin] = await db.insert(users).values({
    username: "admin",
    password,
    email: "admin@essence.com",
    firstName: "System",
    lastName: "Admin",
    role: "admin",
    department: "IT",
    position: "System Administrator",
    employeeId: "ADM-001",
    hireDate: new Date("2023-01-01"),
    salary: 8000000, 
    isActive: true,
    address: dummyAddress,
    emergencyContact: dummyEmergencyContact
  }).returning();

  // Payroll
  const [payroll] = await db.insert(users).values({
    username: "patricia.diaz",
    password,
    email: "patricia.diaz@essence.com",
    firstName: "Patricia",
    lastName: "Diaz",
    role: "payroll_officer",
    department: "Finance",
    position: "Payroll Specialist",
    employeeId: "PAY-001",
    hireDate: new Date("2023-03-01"),
    salary: 4500000, 
    isActive: true,
    address: dummyAddress,
    emergencyContact: dummyEmergencyContact
  }).returning();

  // SINGLE MANAGER
  const managersData = [
    { username: "robert.chen", firstName: "Robert", lastName: "Chen", department: "Operations", position: "General Manager", employeeId: "MAN-001", salary: 7500000 },
  ];

  const managers = [];
  for (const m of managersData) {
    const [created] = await db.insert(users).values({
      ...m,
      email: `${m.username}@essence.com`,
      password,
      role: "manager",
      hireDate: new Date("2023-02-01"),
      isActive: true,
      annualLeaveBalance: 20,
      sickLeaveBalance: 15,
      address: dummyAddress,
      emergencyContact: dummyEmergencyContact
    }).returning();
    managers.push(created);
  }

  const mainManager = managers[0];

  // Employees
  const employeeProfiles = [
    { first: "Marco", last: "Dalisay", pos: "Server", dept: "Operations" },
    { first: "Sofia", last: "Reyes", pos: "Host", dept: "Operations" },
    { first: "Liam", last: "Smith", pos: "Bartender", dept: "Operations" },
    { first: "Angela", last: "Cruz", pos: "Server", dept: "Operations" },
    { first: "Miguel", last: "Santos", pos: "Bartender", dept: "Operations" },
    { first: "James", last: "Oliver", pos: "Line Cook", dept: "Kitchen" },
    { first: "Elena", last: "Torres", pos: "Prep Cook", dept: "Kitchen" },
    { first: "David", last: "Kim", pos: "Line Cook", dept: "Kitchen" },
    { first: "Sarah", last: "Jenkins", pos: "Prep Cook", dept: "Kitchen" },
    { first: "Carlos", last: "Rivera", pos: "Dishwasher", dept: "Kitchen" }
  ];

  const employees = [];
  
  for (let i = 0; i < employeeProfiles.length; i++) {
    const profile = employeeProfiles[i];
    const username = `${profile.first.toLowerCase()}.${profile.last.toLowerCase()}`;
    
    const [emp] = await db.insert(users).values({
      username: username,
      password,
      email: `${username}@essence.com`,
      firstName: profile.first,
      lastName: profile.last,
      role: "employee",
      department: profile.dept,
      position: profile.pos,
      employeeId: `EMP-${String(i + 1).padStart(3, '0')}`,
      managerId: mainManager.id,
      hireDate: new Date("2024-01-15"),
      salary: 2500000 + (Math.floor(Math.random() * 10) * 100000), 
      isActive: true,
      annualLeaveBalance: 15,
      sickLeaveBalance: 10,
      address: dummyAddress,
      emergencyContact: dummyEmergencyContact
    }).returning();
    employees.push(emp);
  }

  const allStaff = [...managers, ...employees]; 

  // 3. Holidays & Announcements
  const holidayList = [
    { name: "New Year's Day", date: new Date("2025-01-01"), type: "regular" },
    { name: "Chinese New Year", date: new Date("2025-01-29"), type: "special" },
    { name: "EDSA Revolution", date: new Date("2025-02-25"), type: "special" },
    { name: "Maundy Thursday", date: new Date("2025-04-17"), type: "regular" },
    { name: "Good Friday", date: new Date("2025-04-18"), type: "regular" },
    { name: "Labor Day", date: new Date("2025-05-01"), type: "regular" },
    { name: "Independence Day", date: new Date("2025-06-12"), type: "regular" },
    { name: "Ninoy Aquino Day", date: new Date("2025-08-21"), type: "special" },
    { name: "National Heroes Day", date: new Date("2025-08-25"), type: "regular" },
    { name: "All Saints' Day", date: new Date("2025-11-01"), type: "special" },
    { name: "Bonifacio Day", date: new Date("2025-11-30"), type: "regular" },
    { name: "Christmas Day", date: new Date("2025-12-25"), type: "regular" },
    { name: "Rizal Day", date: new Date("2025-12-30"), type: "regular" },
    { name: "New Year's Day", date: new Date("2026-01-01"), type: "regular" },
  ];
  
  // Adapt holiday object to new schema
  const holidayInserts = holidayList.map(h => ({
      ...h,
      description: h.name,
      isPaid: true,
      payRateMultiplier: h.type === 'regular' ? 200 : 130
  }));
  await db.insert(holidays).values(holidayInserts);

  await db.insert(announcements).values([
    { title: "Welcome to ESSence", content: "Portal launched.", type: "general", priority: "normal", authorId: admin.id, isActive: true, targetDepartments: [], createdAt: new Date() },
    { title: "Inventory Procedures", content: "Follow breakage protocols.", type: "urgent", priority: "high", authorId: mainManager.id, isActive: true, targetDepartments: ["Kitchen"], createdAt: new Date() }
  ]);

  // =========================================================================
  // 4. LEAVE REQUESTS (UPDATED WITH PENDING)
  // =========================================================================
  console.log("Generating leave requests...");
  const leaveTypes = ["annual", "sick"];
  const leaveReasons = [
    "Family vacation", "Not feeling well", "Personal appointment", 
    "Emergency at home", "Scheduled medical checkup", "Out of town trip"
  ];
  const rejectionReasons = [
    "Shortage of staff on these dates", 
    "Filed too close to the date", 
    "Peak season blackout period"
  ];

  const leaveRequestsData = [];
  
  for (const emp of employees) {
    // Generate 2-5 requests per employee
    const numRequests = Math.floor(Math.random() * 4) + 2; 

    for (let i = 0; i < numRequests; i++) {
        // Random date in the past 6 months or next 1 month
        const dateOffset = Math.floor(Math.random() * 210) - 180; // -180 to +30 days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + dateOffset);
        
        const days = Math.floor(Math.random() * 3) + 1; // 1-3 days
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (days - 1));

        const type = leaveTypes[Math.floor(Math.random() * leaveTypes.length)];
        const reason = leaveReasons[Math.floor(Math.random() * leaveReasons.length)];
        
        // Determine status (UPDATED LOGIC)
        const randStatus = Math.random();
        let status = "approved";
        let rejectionReason = null;
        let approvedBy = mainManager.id;
        let approvedAt = new Date(startDate.getTime() - (2 * 24 * 60 * 60 * 1000));

        // Logic: 20% Pending, 20% Rejected, 60% Approved
        if (randStatus < 0.20) {
            status = "pending";
            approvedBy = null;
            approvedAt = null;
        } else if (randStatus < 0.40) {
            status = "rejected";
            rejectionReason = rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)];
            approvedBy = mainManager.id; // technically "rejected by"
            approvedAt = new Date(startDate.getTime() - (2 * 24 * 60 * 60 * 1000));
        }

        leaveRequestsData.push({
            userId: emp.id,
            type,
            startDate,
            endDate,
            days,
            dayType: "whole",
            reason,
            status,
            rejectionReason,
            approvedBy,
            approvedAt,
            createdAt: new Date(startDate.getTime() - (7 * 24 * 60 * 60 * 1000)) // Applied 7 days before
        });
    }
  }

  // Add EXPLICIT PENDING REQUESTS for Demo Visibility
  const explicitPending = [
    {
      userId: employees[0].id,
      type: "annual",
      startDate: new Date(new Date().setDate(new Date().getDate() + 10)),
      endDate: new Date(new Date().setDate(new Date().getDate() + 12)),
      days: 3,
      dayType: "whole",
      reason: "Family Reunion (Pending Review)",
      status: "pending",
      rejectionReason: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date()
    },
    {
      userId: employees[1].id,
      type: "sick",
      startDate: new Date(new Date().setDate(new Date().getDate() + 5)),
      endDate: new Date(new Date().setDate(new Date().getDate() + 5)),
      days: 1,
      dayType: "whole",
      reason: "Dental Surgery (Pending)",
      status: "pending",
      rejectionReason: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date()
    },
    {
      userId: employees[2].id,
      type: "annual",
      startDate: new Date(new Date().setDate(new Date().getDate() + 20)),
      endDate: new Date(new Date().setDate(new Date().getDate() + 25)),
      days: 5,
      dayType: "whole",
      reason: "Planned Trip Abroad",
      status: "pending",
      rejectionReason: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date()
    }
  ];
  leaveRequestsData.push(...explicitPending);

  await db.insert(leaveRequests).values(leaveRequestsData);

  // =========================================================================
  // 5. INCIDENT REPORTS (Updated with NTE & Assignment Logic)
  // =========================================================================
  console.log("Generating 1 year of incident reports...");
  
  const reportTemplates = [
    { 
      category: "awol", 
      title: "Absent Without Official Leave", 
      severity: "high", 
      desc: "Employee failed to show up for the afternoon shift and did not answer calls.", 
      location: "N/A", 
      actionTaken: "Attempted to contact employee; documented for HR." 
    },
    { 
      category: "tardiness", 
      title: "Repeated Late Arrival", 
      severity: "low", 
      desc: "Employee arrived 20 minutes late for the third time this week.", 
      location: "Front Desk", 
      actionTaken: "Verbal warning issued regarding punctuality." 
    },
    { 
      category: "breakages", 
      title: "Plateware Damage during Rush", 
      severity: "low", 
      desc: "Server dropped a tray of dinner plates while clearing Table 4.", 
      location: "Dining Hall", 
      actionTaken: "Area cordoned off and cleaned immediately.", 
      details: { items: [{ name: "Dinner Plate", quantity: 4 }, { name: "Wine Glass", quantity: 1 }] } 
    },
    { 
      category: "cashier_shortage", 
      title: "POS Cash Discrepancy", 
      severity: "medium", 
      desc: "End-of-day count showed a shortage of $50 compared to digital records.", 
      location: "Main Bar POS", 
      actionTaken: "Re-counting all receipts and checking security footage.", 
      details: { items: [{ name: "Shortage Adjustment", quantity: 50 }] } 
    },
    { 
      category: "awan", 
      title: "Advanced Notice Leave", 
      severity: "low", 
      desc: "Employee requested emergency leave 48 hours in advance due to family matters.", 
      location: "N/A", 
      actionTaken: "Schedule adjusted to cover the gap.", 
      details: {} 
    },
    { 
      category: "others", 
      title: "Uniform Policy Violation", 
      severity: "low", 
      desc: "Staff member arrived without the required apron.", 
      location: "Staff Room", 
      actionTaken: "Provided a spare apron for the shift.", 
      details: {} 
    }
  ];
  
  // Sample explanations for NTEs
  const nteExplanations = [
    "I apologize for the oversight. There was a heavy accident on the highway causing severe traffic.",
    "I honestly forgot to double-check the schedule. It won't happen again.",
    "The plates were slippery due to condensation. I will be more careful next time.",
    "I believe there was a miscount during the shift changeover. I can assist in reviewing the logs.",
    "My alarm did not go off due to a power outage. I arrived as soon as I could.",
    "I wasn't feeling well and forgot to message the group chat. Sorry for the inconvenience."
  ];

  const reportsData = [];
  const TOTAL_REPORTS = 75; 
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  for (let i = 0; i < TOTAL_REPORTS; i++) {
    const template = reportTemplates[Math.floor(Math.random() * reportTemplates.length)];
    
    // Logic: Managers report Employees usually
    const reporter = managers[Math.floor(Math.random() * managers.length)];
    const subject = employees[Math.floor(Math.random() * employees.length)];
    
    const randomTime = oneYearAgo.getTime() + Math.random() * (new Date().getTime() - oneYearAgo.getTime());
    const dateOccurred = new Date(randomTime);
    const isResolved = Math.random() > 0.4;

    // Determine NTE Requirement based on Category
    let requiresNTE = false;
    if (['awol', 'cashier_shortage', 'tardiness'].includes(template.category)) {
        requiresNTE = Math.random() > 0.1; // 90% chance
    } else if (template.category === 'breakages') {
        requiresNTE = Math.random() > 0.6; // 40% chance
    }

    // Determine if NTE was submitted (if required)
    let nteContent = null;
    if (requiresNTE && Math.random() > 0.3) {
        nteContent = nteExplanations[Math.floor(Math.random() * nteExplanations.length)];
    }

    // Prepare involved parties string
    const involved = `${subject.firstName} ${subject.lastName}`;
    
    reportsData.push({
      userId: reporter.id, // The Manager filing the report
      category: template.category,
      title: template.title,
      description: template.desc,
      severity: template.severity,
      status: isResolved ? "resolved" : "pending", 
      location: template.location,
      dateOccurred: dateOccurred,
      timeOccurred: `${10 + Math.floor(Math.random() * 12)}:${Math.floor(Math.random() * 6) * 10}`,
      partiesInvolved: involved,
      witnesses: "Shift Lead / On-duty Staff",
      
      // NTE Fields
      nteRequired: requiresNTE,
      assignedTo: requiresNTE ? subject.id : null, // Assign to the subject if NTE required
      nteContent: nteContent,

      actionTaken: isResolved ? `Resolution: ${template.actionTaken}` : template.actionTaken,
      details: template.details || {},
      images: [],
      resolvedBy: isResolved ? mainManager.id : null,
      resolvedAt: isResolved ? new Date(dateOccurred.getTime() + 86400000) : null,
      createdAt: dateOccurred
    });
  }

  // Ensure a few recent critical reports for priority sorting
  reportsData.push({
      userId: mainManager.id,
      category: "others",
      title: "Health & Safety Hazard",
      description: "Water leak near POS terminals causing electrical sparks.",
      severity: "critical",
      status: "pending",
      location: "Main Hall",
      dateOccurred: new Date(),
      timeOccurred: "08:30",
      partiesInvolved: `${employees[0].firstName} ${employees[0].lastName}`,
      witnesses: "Front of House Team",
      nteRequired: false, // Usually safety hazards don't need NTE from specific staff unless negligent
      assignedTo: null,
      nteContent: null,
      actionTaken: "Maintenance called, area cordoned off.",
      details: {},
      images: [],
      createdAt: new Date()
  });

  // Ensure a specific recent Pending NTE for testing
  reportsData.push({
      userId: mainManager.id,
      category: "tardiness",
      title: "Late Arrival - No Call",
      description: "Arrived 1 hour late without prior notice.",
      severity: "medium",
      status: "pending",
      location: "Entrance",
      dateOccurred: new Date(), // Today
      timeOccurred: "09:00",
      partiesInvolved: `${employees[0].firstName} ${employees[0].lastName}`,
      witnesses: "Reception",
      nteRequired: true,
      assignedTo: employees[0].id, // Assign to first employee for testing
      nteContent: null, // Empty content to show "Action Required"
      actionTaken: "Waiting for explanation.",
      details: {},
      images: [],
      createdAt: new Date()
  });

  await db.insert(reports).values(reportsData);

  // =========================================================================
  // 6. ATTENDANCE & PAYSLIP GENERATION (12 Months)
  // =========================================================================
  console.log("Generating attendance and payslips (Employees Only)...");
  const now = new Date(); 
  const periods = [];
  for (let i = 0; i < 12; i++) {
     const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
     const m = d.getMonth();
     const y = d.getFullYear();
     const lastDay = new Date(y, m + 1, 0).getDate();
     periods.push({ month: m, year: y, startDay: 16, endDay: lastDay, periodNum: 2 });
     periods.push({ month: m, year: y, startDay: 1, endDay: 15, periodNum: 1 });
  }
  periods.reverse();

  const payslipsToInsert = [];
  // UPDATED: Iterate only over `employees`, excluding `managers`
  for (const emp of employees) {
    for (const p of periods) {
        let periodRegHours = 0; let periodOtHours = 0; let periodNdHours = 0;
        let periodRegHolidayHours = 0; let periodRegHolidayOtHours = 0;
        let periodSpecHolidayHours = 0; let periodSpecHolidayOtHours = 0;

        for (let d = p.startDay; d <= p.endDay; d++) {
            const workDate = new Date(p.year, p.month, d);
            if (workDate.getDay() === 0) continue; // Sunday off

            if (Math.random() > 0.1) {
                const { start, end } = getRandomShift(emp.position || "Staff", workDate);
                const timeIn = new Date(start); timeIn.setMinutes(timeIn.getMinutes() + (Math.random() * 30 - 15));
                const timeOut = new Date(end); timeOut.setMinutes(timeOut.getMinutes() + (Math.random() * 45)); 

                const durationMs = timeOut.getTime() - timeIn.getTime();
                const totalMinutes = Math.floor(durationMs / 60000);
                const breakMinutes = 60;
                const workMinutes = Math.max(0, totalMinutes - breakMinutes);

                let dailyReg = 0; let dailyOT = 0;
                if (workMinutes > 480) { dailyReg = 480; dailyOT = workMinutes - 480; } else { dailyReg = workMinutes; }
                const ndHrs = getNightDiffHours(timeIn, timeOut);
                periodNdHours += ndHrs;

                const [att] = await db.insert(attendance).values({
                    userId: emp.id, date: workDate, timeIn: timeIn, timeOut: timeOut,
                    status: "clocked_out", totalBreakMinutes: breakMinutes, totalWorkMinutes: workMinutes, 
                    notes: "Regular shift",
                    // New columns
                    clockInDevice: "Biometric Scanner A",
                    clockOutDevice: "Biometric Scanner A",
                    isLate: timeIn > start,
                    lateMinutes: timeIn > start ? Math.floor((timeIn.getTime() - start.getTime()) / 60000) : 0,
                    overtimeMinutes: dailyOT,
                    isUndertime: workMinutes < 480,
                    undertimeMinutes: workMinutes < 480 ? 480 - workMinutes : 0
                }).returning();

                await db.insert(breaks).values({
                    attendanceId: att.id, userId: emp.id, breakStart: new Date(timeIn.getTime() + 4 * 3600000), breakEnd: new Date(timeIn.getTime() + 5 * 3600000),
                    breakMinutes: 60, breakType: "lunch", notes: "Lunch"
                });

                let isRegHoliday = false; let isSpecHoliday = false;
                if (SHOW_HOLIDAY_FEATURES) {
                   const hType = getHolidayType(workDate, holidayList);
                   if (hType === 'regular') isRegHoliday = true;
                   if (hType === 'special') isSpecHoliday = true;
                }

                if (isRegHoliday) { periodRegHolidayHours += (dailyReg / 60); periodRegHolidayOtHours += (dailyOT / 60); } 
                else if (isSpecHoliday) { periodSpecHolidayHours += (dailyReg / 60); periodSpecHolidayOtHours += (dailyOT / 60); } 
                else { periodRegHours += (dailyReg / 60); periodOtHours += (dailyOT / 60); }
            }
        }

        const basicSalary = periodRegHours * HOURLY_RATE;
        const overtimePay = periodOtHours * (HOURLY_RATE * OT_MULTIPLIER);
        const nightDiffPay = periodNdHours * (HOURLY_RATE * ND_MULTIPLIER);
        let holidayPay = 0;
        if (SHOW_HOLIDAY_FEATURES) {
             holidayPay += (periodRegHolidayHours * HOURLY_RATE * REG_HOLIDAY_MULTIPLIER) + (periodRegHolidayOtHours * HOURLY_RATE * REG_HOLIDAY_OT_MULTIPLIER) + (periodSpecHolidayHours * HOURLY_RATE * SPL_HOLIDAY_MULTIPLIER) + (periodSpecHolidayOtHours * HOURLY_RATE * SPL_HOLIDAY_OT_MULTIPLIER);
        }
        const grossPay = basicSalary + overtimePay + nightDiffPay + holidayPay + 1000;
        const sss = computeSSS(grossPay);
        const philHealth = computePhilHealth(grossPay);
        const pagIbig = computePagIbig(grossPay);
        const netPay = Math.max(0, grossPay - (sss + philHealth + pagIbig));

        // Schema requires integers (cents) for DB storage
        payslipsToInsert.push({
            userId: emp.id, month: p.month + 1, year: p.year, period: p.periodNum,
            basicSalary: Math.round(basicSalary * 100),
            overtimePay: Math.round(overtimePay * 100),
            nightDiffPay: Math.round(nightDiffPay * 100),
            holidayPay: Math.round(holidayPay * 100),
            
            // Explicit Deductions
            sssContribution: Math.round(sss * 100),
            philHealthContribution: Math.round(philHealth * 100),
            pagIbigContribution: Math.round(pagIbig * 100),
            withholdingTax: 0,

            // JSON fields for extras
            allowances: [{ name: "Rice Subsidy", amount: 100000 }], 
            otherDeductions: [], 

            grossPay: Math.round(grossPay * 100), 
            totalDeductions: Math.round((sss + philHealth + pagIbig) * 100),
            netPay: Math.round(netPay * 100), 
            
            paymentStatus: "paid",
            paymentDate: new Date(),
            generatedAt: new Date()
        });
    }
  }
  await db.insert(payslips).values(payslipsToInsert);

  // =========================================================================
  // 7. SCHEDULE GENERATION (Current Week)
  // =========================================================================
  console.log("Generating future schedules (Employees Only)...");
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0,0,0,0);

  const shiftData = [];
  // UPDATED: Iterate only over `employees`, excluding `managers`
  for (const emp of employees) {
    for (let d = 0; d < 6; d++) { // Mon-Sat
      const workDate = new Date(startOfWeek);
      workDate.setDate(startOfWeek.getDate() + d);
      
      const { type: shiftTimeType, start, end } = getRandomShift(emp.position || "Staff", workDate);
      const mappedRole = mapPositionToShiftRole(emp.position || "");

      shiftData.push({
        userId: emp.id,
        date: workDate,
        startTime: start,
        endTime: end,
        shiftType: shiftTimeType, // "Morning", "Afternoon", "Night"
        shiftRole: mappedRole, // Now explicitly using the column
        location: emp.department === 'Kitchen' ? 'Kitchen' : 'Main Hall',
        isRemote: false,
        gracePeriodMinutes: 15,
        breakDurationMinutes: 60,
        status: "published"
      });
    }
  }
  await db.insert(schedules).values(shiftData);

  // 8. Analytics Data
  console.log("Generating analytics with 9-13% labor cost variance...");
  const laborData = [];
  const payrollByMonth = payslipsToInsert.reduce((acc: any, p: any) => {
      const key = `${p.year}-${p.month}`;
      if (!acc[key]) acc[key] = 0;
      acc[key] += p.grossPay; // This is in "cents" (grossPay * 100)
      return acc;
  }, {});

  for (const [key, totalCostInCents] of Object.entries(payrollByMonth)) {
      const [y, m] = key.split('-');
      
      // Randomize labor cost percentage between 9.0 and 13.0
      // Math.random() * (max - min) + min
      const randomPercentage = Math.random() * (13 - 9) + 9;
      
      // Calculate Total Sales based on the labor cost and the random percentage
      // formula: Sales = LaborCost / Percentage
      // Example: If Labor is 100k and % is 10, Sales is 1M.
      const totalSales = (totalCostInCents as number) / (randomPercentage / 100);

      // Determine status based on your 12% benchmark
      let status = "Warning";
      let performanceRating = "warning";

      if (randomPercentage < 11) {
        status = "Excellent";
        performanceRating = "good";
      } else if (randomPercentage <= 12) {
        status = "Good";
        performanceRating = "good";
      }

      laborData.push({
        month: parseInt(m), 
        year: parseInt(y),
        totalSales: Math.round(totalSales), // Stored as integer
        totalLaborCost: totalCostInCents as number, // Already stored as integer
        laborCostPercentage: Math.round(randomPercentage * 100), // stored as integer (e.g., 1250 for 12.5%)
        targetSales: Math.round(totalSales * 1.1),
        budgetedLaborCost: Math.round((totalCostInCents as number) * 0.95),
        status: status, 
        performanceRating: performanceRating, 
        notes: `Seed Data: Calculated at ${randomPercentage.toFixed(2)}% efficiency.`
      });
  }
  await db.insert(laborCostData).values(laborData);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});