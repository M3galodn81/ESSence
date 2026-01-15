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
    isActive: true
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
    isActive: true
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
      sickLeaveBalance: 15
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
      sickLeaveBalance: 10
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
  await db.insert(holidays).values(holidayList);

  await db.insert(announcements).values([
    { title: "Welcome to ESSence", content: "Portal launched.", type: "general", authorId: admin.id, isActive: true, targetDepartments: [], createdAt: new Date() },
    { title: "Inventory Procedures", content: "Follow breakage protocols.", type: "urgent", authorId: mainManager.id, isActive: true, targetDepartments: ["Kitchen"], createdAt: new Date() }
  ]);

  // 4. Incident Reports - SIMULATED 1 YEAR HISTORY
  console.log("Generating 1 year of incident reports...");
  const reportTemplates = [
    // Customer Issues
    { category: "customer", title: "Intoxicated Guest Harassment", severity: "high", desc: "Guest at Table 5 became belligerent after being cut off.", location: "Dining Hall", actionTaken: "Security called, guest removed.", details: { policeReportNumber: "N/A" } },
    { category: "customer", title: "Dine and Dash", severity: "medium", desc: "Party of 4 left without paying $200 bill.", location: "Patio", actionTaken: "Police report filed.", details: { policeReportNumber: "PR-2025-042" } },
    { category: "customer", title: "Noise Complaint", severity: "low", desc: "Table 2 complained about music volume.", location: "Bar", actionTaken: "Volume lowered.", details: {} },
    
    // Employee Issues
    { category: "employee", title: "No Call No Show", severity: "medium", desc: "Employee failed to report for scheduled shift.", location: "N/A", actionTaken: "Written warning issued.", details: {} },
    { category: "employee", title: "Uniform Violation", severity: "low", desc: "Staff member wearing open-toed shoes.", location: "Kitchen", actionTaken: "Sent home to change.", details: {} },
    { category: "employee", title: "Insubordination", severity: "high", desc: "Staff refused direct order from manager.", location: "Prep Area", actionTaken: "Meeting scheduled with HR.", details: {} },

    // Accidents
    { category: "accident", title: "Slip and Fall", severity: "medium", desc: "Prep cook slipped on wet floor near dish pit.", location: "Dish Pit", actionTaken: "First aid applied, area cleaned.", details: { injuryType: "Contusion", medicalAction: "Ice pack" } },
    { category: "accident", title: "Minor Burn", severity: "low", desc: "Line cook touched hot pan handle.", location: "Hot Line", actionTaken: "Burn cream applied.", details: { injuryType: "1st Degree Burn" } },
    { category: "accident", title: "Glass Cut", severity: "medium", desc: "Bartender cut hand on broken glass in ice bin.", location: "Bar", actionTaken: "Bandaged, ice bin burned and refilled.", details: { injuryType: "Laceration" } },

    // Security
    { category: "security", title: "Backdoor Lock Tampered", severity: "high", desc: "Scratch marks found on delivery entrance lock.", location: "Back Door", actionTaken: "Locksmith called, police notified.", details: { policeReportNumber: "PR-2025-889" } },
    { category: "security", title: "Lost Item", severity: "low", desc: "Guest left iPhone 14 at bar.", location: "Bar", actionTaken: "Placed in safe.", details: { itemName: "iPhone 14" } },
    { category: "security", title: "Vandalism", severity: "medium", desc: "Graffiti found in men's restroom.", location: "Restroom", actionTaken: "Cleaned immediately.", details: {} },

    // Medical
    { category: "medical", title: "Guest Allergic Reaction", severity: "critical", desc: "Guest had reaction to peanuts.", location: "Table 12", actionTaken: "EpiPen administered, ambulance called.", details: { injuryType: "Anaphylaxis", medicalAction: "Ambulance" } },
    { category: "medical", title: "Staff Fainting", severity: "high", desc: "Server fainted due to heat exhaustion.", location: "Server Station", actionTaken: "Given water and rest.", details: { medicalAction: "Rest" } },

    // Property
    { category: "property", title: "Broken POS Terminal", severity: "medium", desc: "Screen cracked after being knocked over.", location: "Bar POS", actionTaken: "IT notified for replacement.", details: { itemName: "iPad Pro", estimatedCost: 1200 } },
    { category: "property", title: "Leaking Sink", severity: "low", desc: "Handwash sink leaking onto floor.", location: "Kitchen", actionTaken: "Plumber called.", details: { itemName: "Sink Pipe", estimatedCost: 300 } },
    { category: "property", title: "Broken Plate", severity: "low", desc: "Stack of dinner plates dropped.", location: "Dish Pit", actionTaken: "Cleaned up.", details: { itemName: "Dinner Plates (5)", estimatedCost: 50 } },
  ];
  
  const reportsData = [];
  const TOTAL_REPORTS = 65; // Generate 65 reports over the year
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  for (let i = 0; i < TOTAL_REPORTS; i++) {
    const template = reportTemplates[Math.floor(Math.random() * reportTemplates.length)];
    const reporter = employees[Math.floor(Math.random() * employees.length)];
    
    // Random date within last 365 days
    const randomTime = oneYearAgo.getTime() + Math.random() * (new Date().getTime() - oneYearAgo.getTime());
    const dateOccurred = new Date(randomTime);

    // Random time of day (10am - 11pm)
    const hour = 10 + Math.floor(Math.random() * 13);
    const minute = Math.floor(Math.random() * 60);
    const timeOccurred = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    reportsData.push({
      userId: reporter.id,
      category: template.category,
      title: template.title,
      description: template.desc,
      severity: template.severity,
      status: Math.random() > 0.3 ? "resolved" : (Math.random() > 0.5 ? "investigating" : "pending"), // Mix of statuses
      location: template.location,
      dateOccurred: dateOccurred,
      timeOccurred: timeOccurred,
      partiesInvolved: "Staff/Guests",
      witnesses: `${employees[Math.floor(Math.random() * employees.length)].firstName} ${employees[Math.floor(Math.random() * employees.length)].lastName}`,
      actionTaken: template.actionTaken,
      details: template.details || {},
      resolvedBy: template.severity === "low" || Math.random() > 0.5 ? mainManager.id : null,
      resolvedAt: template.severity === "low" || Math.random() > 0.5 ? new Date(dateOccurred.getTime() + 86400000) : null, // Resolved next day
      createdAt: dateOccurred // Created at occurrence time
    });
  }
  // Add a few for "Today" specifically
  reportsData.push({
      userId: employees[0].id,
      category: "property",
      title: "Broken Wine Glass",
      description: "Dropped tray during lunch rush.",
      severity: "low",
      status: "pending",
      location: "Main Dining",
      dateOccurred: new Date(),
      timeOccurred: "12:30",
      partiesInvolved: "N/A",
      witnesses: "N/A",
      actionTaken: "Cleaned up.",
      details: { itemName: "Red Wine Glass", estimatedCost: 10 },
      createdAt: new Date()
  });

  await db.insert(reports).values(reportsData);


  // =========================================================================
  // 5. ATTENDANCE & PAYSLIP GENERATION (12 Months)
  // =========================================================================
  console.log("Generating attendance and payslips...");
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
  for (const emp of allStaff) {
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
        const grossPay = basicSalary + overtimePay + nightDiffPay + holidayPay + 1000;
        const sss = computeSSS(grossPay);
        const philHealth = computePhilHealth(grossPay);
        const pagIbig = computePagIbig(grossPay);
        const netPay = Math.max(0, grossPay - (sss + philHealth + pagIbig));

        payslipsToInsert.push({
            userId: emp.id, month: p.month + 1, year: p.year, period: p.periodNum,
            basicSalary: Math.round(basicSalary * 100),
            allowances: { overtime: Math.round(overtimePay * 100), nightDiff: Math.round(nightDiffPay * 100), holidayPay: Math.round(holidayPay * 100), allowances: 100000, regHolidayHours: periodRegHolidayHours, specHolidayHours: periodSpecHolidayHours },
            deductions: { sss: Math.round(sss * 100), philHealth: Math.round(philHealth * 100), pagIbig: Math.round(pagIbig * 100), tax: 0 },
            grossPay: Math.round(grossPay * 100), netPay: Math.round(netPay * 100), generatedAt: new Date()
        });
    }
  }
  await db.insert(payslips).values(payslipsToInsert);

  // =========================================================================
  // 6. SCHEDULE GENERATION (Current Week)
  // =========================================================================
  console.log("Generating future schedules...");
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0,0,0,0);

  const shiftData = [];
  for (const emp of allStaff) {
    for (let d = 0; d < 6; d++) { // Mon-Sat
      const workDate = new Date(startOfWeek);
      workDate.setDate(startOfWeek.getDate() + d);
      
      const { type, start, end } = getRandomShift(emp.position || "Staff", workDate);
      
      // *** CRITICAL CHANGE: MAPPING LOGIC APPLIED HERE ***
      const mappedRole = mapPositionToShiftRole(emp.position || "");

      shiftData.push({
        userId: emp.id,
        date: workDate,
        startTime: start,
        endTime: end,
        type: type,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Shift`,
        shiftRole: mappedRole, // Uses strict "cashier", "bar", "server", "kitchen"
        location: emp.department === 'Kitchen' ? 'Kitchen' : 'Main Hall'
      });
    }
  }
  await db.insert(schedules).values(shiftData);

  // 7. Analytics Data
  console.log("Generating analytics...");
  const laborData = [];
  const payrollByMonth = payslipsToInsert.reduce((acc: any, p: any) => {
      const key = `${p.year}-${p.month}`;
      if (!acc[key]) acc[key] = 0;
      acc[key] += p.grossPay;
      return acc;
  }, {});

  for (const [key, totalCost] of Object.entries(payrollByMonth)) {
      const [y, m] = key.split('-');
      laborData.push({
        month: parseInt(m), year: parseInt(y),
        totalSales: Math.round((totalCost as number) * 0.04 * 100), // 25% cost
        totalLaborCost: totalCost as number, laborCostPercentage: 2500,
        status: "Excellent", performanceRating: "A", notes: "Seed Data"
      });
  }
  await db.insert(laborCostData).values(laborData);

  console.log("Seed completed successfully!");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});