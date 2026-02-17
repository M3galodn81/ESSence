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
const HOURLY_RATE = 5875; // in cents (58.75)
const OT_MULTIPLIER = 1.25;
const ND_MULTIPLIER = 1.1;

// Holiday Rates
const REG_HOLIDAY_MULTIPLIER = 2.0;
const REG_HOLIDAY_OT_MULTIPLIER = 2.5;
const SPL_HOLIDAY_MULTIPLIER = 1.3;
const SPL_HOLIDAY_OT_MULTIPLIER = 1.63;

// SSS Contribution Table (Simplified 2025) - Amounts in cents
const sssBrackets = [
  { min: 0,        max: 524999,  ms: 500000,  ee: 25000 },
  { min: 525000,   max: 574999,  ms: 550000,  ee: 27500 },
  { min: 575000,   max: 624999,  ms: 600000,  ee: 30000 },
  { min: 625000,   max: 674999,  ms: 650000,  ee: 32500 },
  { min: 675000,   max: 724999,  ms: 700000,  ee: 35000 },
  { min: 725000,   max: 774999,  ms: 750000,  ee: 37500 },
  { min: 775000,   max: 824999,  ms: 800000,  ee: 40000 },
  { min: 825000,   max: 874999,  ms: 850000,  ee: 42500 },
  { min: 875000,   max: 924999,  ms: 900000,  ee: 45000 },
  { min: 925000,   max: 974999,  ms: 950000,  ee: 47500 },
  { min: 975000,   max: 1024999, ms: 1000000, ee: 50000 },
  // ... Simplified for brevity, add more brackets if needed
  { min: 1975000,  max: 3474999, ms: 2000000, ee: 100000 }
];

const computeSSS = (grossSalary: number) => {
  const bracket = sssBrackets.find(b => grossSalary >= b.min && grossSalary <= b.max);
  if (!bracket) return 100000; // 1000.00 default
  return bracket.ee;
};

const computePagIbig = (basic: number) => {
  const rate = basic <= 150000 ? 0.01 : 0.02;
  const capped = Math.min(basic, 1000000); // 10k cap
  return Math.round(capped * rate);
};

const computePhilHealth = (basic: number) => {
  let income = basic;
  if (income < 1000000) income = 1000000;
  if (income > 10000000) income = 10000000;
  return Math.round((income * 0.05) / 2);
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
    const holiday = holidayList.find(h => new Date(h.date).toISOString().split('T')[0] === dStr);
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

  const adminAddress = { street: "123 Admin St", city: "Manila", province: "Metro Manila", zipCode: "1000" };
  const adminContact = { name: "Emergency Admin", relation: "Partner", phone: "09170000000" };

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
    address: adminAddress,
    emergencyContact: adminContact,
    employmentStatus: "regular"
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
    address: { street: "456 Finance Ave", city: "Makati", province: "Metro Manila", zipCode: "1200" },
    emergencyContact: { name: "Juan Diaz", relation: "Father", phone: "09171111111" },
    employmentStatus: "regular"
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
      address: { street: "789 Ops Rd", city: "Taguig", province: "Metro Manila", zipCode: "1630" },
      emergencyContact: { name: "Maria Chen", relation: "Spouse", phone: "09172222222" },
      employmentStatus: "regular"
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
      address: { street: `Block ${i+1} Lot ${i+1}`, city: "Quezon City", province: "Metro Manila", zipCode: "1100" },
      emergencyContact: { name: `Contact ${i+1}`, relation: "Relative", phone: `0917333333${i}` },
      employmentStatus: i > 7 ? "probationary" : "regular"
    }).returning();
    employees.push(emp);
  }

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
  await db.insert(holidays).values(holidayList);

  await db.insert(announcements).values([
    { title: "Welcome to ESSence", content: "Portal launched.", type: "general", authorId: admin.id, isActive: true, targetDepartments: [], createdAt: new Date() },
    { title: "Inventory Procedures", content: "Follow breakage protocols.", type: "urgent", authorId: mainManager.id, isActive: true, targetDepartments: ["Kitchen"], createdAt: new Date() }
  ]);

  // =========================================================================
  // 4. LEAVE REQUESTS
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
    const numRequests = Math.floor(Math.random() * 4) + 2; 

    for (let i = 0; i < numRequests; i++) {
        const dateOffset = Math.floor(Math.random() * 210) - 180; 
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + dateOffset);
        
        const days = Math.floor(Math.random() * 3) + 1;
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (days - 1));

        const type = leaveTypes[Math.floor(Math.random() * leaveTypes.length)];
        const reason = leaveReasons[Math.floor(Math.random() * leaveReasons.length)];
        
        const randStatus = Math.random();
        let status = "approved";
        let comments = null;
        let managerId = mainManager.id;

        if (randStatus < 0.20) {
            status = "pending";
        } else if (randStatus < 0.40) {
            status = "rejected";
            comments = rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)];
        } else {
            status = "approved";
        }

        leaveRequestsData.push({
            userId: emp.id,
            type,
            startDate,
            endDate,
            days,
            reason,
            status,
            approvedBy: status === 'approved' ? managerId : null,
            comments,
            createdAt: new Date(startDate.getTime() - (7 * 24 * 60 * 60 * 1000))
        });
    }
  }

  // Explicit Pending Requests
  leaveRequestsData.push({
      userId: employees[0].id,
      type: "annual",
      startDate: new Date(new Date().setDate(new Date().getDate() + 10)),
      endDate: new Date(new Date().setDate(new Date().getDate() + 12)),
      days: 3,
      reason: "Family Reunion (Pending Review)",
      status: "pending",
      createdAt: new Date()
  });

  await db.insert(leaveRequests).values(leaveRequestsData);

  // =========================================================================
  // 5. INCIDENT REPORTS
  // =========================================================================
  console.log("Generating 1 year of incident reports...");
  
  const reportTemplates = [
    { category: "awol", title: "Absent Without Official Leave", severity: "high", desc: "Employee failed to show up.", location: "N/A", actionTaken: "Contacted employee." },
    { category: "tardiness", title: "Repeated Late Arrival", severity: "low", desc: "Arrived 20 mins late.", location: "Front Desk", actionTaken: "Verbal warning." },
    { category: "breakages", title: "Plateware Damage", severity: "low", desc: "Dropped tray.", location: "Dining Hall", actionTaken: "Cleaned up." },
    { category: "cashier_shortage", title: "POS Shortage", severity: "medium", desc: "Short 500 PHP.", location: "Main Bar", actionTaken: "Logged discrepancy." },
  ];
  
  const reportsData = [];
  const TOTAL_REPORTS = 75; 
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  for (let i = 0; i < TOTAL_REPORTS; i++) {
    const template = reportTemplates[Math.floor(Math.random() * reportTemplates.length)];
    const subject = employees[Math.floor(Math.random() * employees.length)];
    const randomTime = oneYearAgo.getTime() + Math.random() * (new Date().getTime() - oneYearAgo.getTime());
    const dateOccurred = new Date(randomTime);
    const isResolved = Math.random() > 0.4;

    let nteRequired = ['awol', 'cashier_shortage'].includes(template.category) && Math.random() > 0.3;

    reportsData.push({
      userId: mainManager.id, // Reporter
      category: template.category,
      title: template.title,
      description: template.desc,
      severity: template.severity,
      status: isResolved ? "resolved" : "pending", 
      location: template.location,
      dateOccurred: dateOccurred.getTime(),
      timeOccurred: `${10 + Math.floor(Math.random() * 12)}:${Math.floor(Math.random() * 6) * 10}`,
      partiesInvolved: `${subject.firstName} ${subject.lastName}`,
      witnesses: "Shift Lead",
      
      nteRequired: nteRequired,
      assignedTo: nteRequired ? subject.id : null,
      nteContent: nteRequired && Math.random() > 0.5 ? "I was stuck in traffic." : null,

      actionTaken: isResolved ? `Resolution: ${template.actionTaken}` : template.actionTaken,
      details: { items: [] },
      images: [],
      resolvedBy: isResolved ? mainManager.id : null,
      resolvedAt: isResolved ? new Date(dateOccurred.getTime() + 86400000) : null,
      createdAt: dateOccurred
    });
  }

  await db.insert(reports).values(reportsData);

  // =========================================================================
  // 6. ATTENDANCE & PAYSLIP GENERATION
  // =========================================================================
  console.log("Generating attendance and payslips...");
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

                const [att] = await db.insert(attendance).values({
                    userId: emp.id, date: workDate, timeIn: timeIn, timeOut: timeOut,
                    status: "clocked_out", totalBreakMinutes: breakMinutes, totalWorkMinutes: workMinutes, notes: "Regular shift"
                }).returning();

                await db.insert(breaks).values({
                    attendanceId: att.id, userId: emp.id, breakStart: new Date(timeIn.getTime() + 4 * 3600000), breakEnd: new Date(timeIn.getTime() + 5 * 3600000),
                    breakMinutes: 60, breakType: "lunch", notes: "Lunch"
                });

                let dailyReg = 0; let dailyOT = 0;
                if (workMinutes > 480) { dailyReg = 480; dailyOT = workMinutes - 480; } else { dailyReg = workMinutes; }
                const ndHrs = getNightDiffHours(timeIn, timeOut);
                periodNdHours += ndHrs;

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
        
        const grossPay = Math.round(basicSalary + overtimePay + nightDiffPay + holidayPay + 100000); // +1000 Allowance
        const sss = computeSSS(grossPay);
        const philHealth = computePhilHealth(grossPay);
        const pagIbig = computePagIbig(grossPay);
        const totalDeductions = sss + philHealth + pagIbig;
        const netPay = Math.max(0, grossPay - totalDeductions);

        payslipsToInsert.push({
            userId: emp.id, month: p.month + 1, year: p.year, period: p.periodNum,
            basicSalary: Math.round(basicSalary),
            allowances: [ { name: "COLA", amount: 100000 } ], // 1000.00
            deductions: [], // Detailed deductions stored in separate columns now, but keeping this for legacy structure compatibility if needed
            sssContribution: sss,
            philHealthContribution: philHealth,
            pagIbigContribution: pagIbig,
            totalDeductions: totalDeductions,
            grossPay: grossPay, 
            netPay: netPay, 
            generatedAt: new Date()
        });
    }
  }
  await db.insert(payslips).values(payslipsToInsert);

  // =========================================================================
  // 7. SCHEDULE GENERATION
  // =========================================================================
  console.log("Generating future schedules...");
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0,0,0,0);

  const shiftData = [];
  for (const emp of employees) {
    for (let d = 0; d < 6; d++) { 
      const workDate = new Date(startOfWeek);
      workDate.setDate(startOfWeek.getDate() + d);
      
      const { type, start, end } = getRandomShift(emp.position || "Staff", workDate);
      const mappedRole = mapPositionToShiftRole(emp.position || "");

      shiftData.push({
        userId: emp.id,
        date: workDate,
        startTime: start,
        endTime: end,
        type: type,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Shift`,
        shiftRole: mappedRole,
        location: emp.department === 'Kitchen' ? 'Kitchen' : 'Main Hall'
      });
    }
  }
  await db.insert(schedules).values(shiftData);

  // 8. Analytics Data
  console.log("Generating analytics...");
  const laborData = [];
  const payrollByMonth = payslipsToInsert.reduce((acc: any, p: any) => {
      const key = `${p.year}-${p.month}`;
      if (!acc[key]) acc[key] = 0;
      acc[key] += p.grossPay; 
      return acc;
  }, {});

  for (const [key, totalCostInCents] of Object.entries(payrollByMonth)) {
      const [y, m] = key.split('-');
      const randomPercentage = Math.random() * (13 - 9) + 9;
      const totalSales = (totalCostInCents as number) / (randomPercentage / 100);

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
        totalSales: Math.round(totalSales),
        totalLaborCost: totalCostInCents as number,
        laborCostPercentage: Math.round(randomPercentage * 100), 
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