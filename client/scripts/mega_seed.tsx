import { db } from "../../server/db";
import { 
  users, holidays, announcements, leaveRequests, 
  schedules, reports, laborCostData, attendance, 
  breaks, activities, payslips
} from "../../shared/schema";
import { hashPassword } from "../../server/auth";

// --- TOGGLE FEATURES ---
const SHOW_HOLIDAY_FEATURES = true; // Toggle this to false to hide holiday features

// --- Constants & Helpers ---
const HOURLY_RATE = 58.75;
const OT_MULTIPLIER = 1.25;
const ND_MULTIPLIER = 1.1;

// Holiday Rates
const REG_HOLIDAY_MULTIPLIER = 2.0;     // 200%
const REG_HOLIDAY_OT_MULTIPLIER = 2.5;  // 250%
const SPL_HOLIDAY_MULTIPLIER = 1.3;     // 130%
const SPL_HOLIDAY_OT_MULTIPLIER = 1.63; // 163%

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

// Helper to check holiday
const getHolidayType = (date: Date, holidayList: any[]) => {
    const dStr = date.toISOString().split('T')[0];
    const holiday = holidayList.find(h => h.date.toISOString().split('T')[0] === dStr);
    return holiday ? holiday.type : null;
};

async function seed() {
  console.log("Starting database seeding...");

  // 1. Clean tables
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
  const password = await hashPassword("qweqwe"); 

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
    salary: 4500000, 
    isActive: true
  }).returning();

  const managersData = [
    { username: "manager1", firstName: "Sarah", lastName: "Connor", department: "Operations", position: "Operations Manager", employeeId: "MAN-001", salary: 6000000 },
    { username: "manager2", firstName: "Gordon", lastName: "Ramsay", department: "Kitchen", position: "Head Chef", employeeId: "MAN-002", salary: 7000000 }
  ];

  const managers = [];
  for (const m of managersData) {
    const [created] = await db.insert(users).values({
      ...m,
      email: `${m.username}@essence.com`,
      password,
      role: "manager",
      hireDate: new Date("2023-02-01"),
      isActive: true
    }).returning();
    managers.push(created);
  }

  const employees = [];
  const positions = ["Server", "Bartender", "Host", "Line Cook", "Prep Cook"];
  
  for (let i = 1; i <= 10; i++) {
    const isOps = i <= 5; 
    const manager = isOps ? managers[0] : managers[1];
    const dept = isOps ? "Operations" : "Kitchen";
    const pos = isOps ? positions[Math.floor(Math.random() * 3)] : positions[3 + Math.floor(Math.random() * 2)];

    const [emp] = await db.insert(users).values({
      username: `employee${i}`,
      password,
      email: `employee${i}@essence.com`,
      firstName: `Employee`,
      lastName: `${i}`,
      role: "employee",
      department: dept,
      position: pos,
      employeeId: `EMP-${String(i).padStart(3, '0')}`,
      managerId: manager.id,
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
  // Insert a wider range of holidays for the 12-month simulation
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
  ];
  
  await db.insert(holidays).values(holidayList);

  await db.insert(announcements).values([
    { title: "Welcome to ESSence", content: "We are excited to introduce our new Employee Self-Service portal.", type: "general", authorId: admin.id, isActive: true, targetDepartments: [], createdAt: new Date() },
    { title: "Inventory Check", content: "Report breakages immediately.", type: "urgent", authorId: managers[1].id, isActive: true, targetDepartments: ["Kitchen"], createdAt: new Date() }
  ]);

  // 4. Incident Reports
  const reportTypes = [
    { type: "incident", title: "Slippery Floor", severity: "medium", desc: "Water spill near dishwashing." },
    { type: "breakage", title: "Broken Glassware", severity: "low", desc: "Dropped wine glasses." }
  ];
  const reportsData = [];
  for (let i = 0; i < 4; i++) {
    const reporter = employees[Math.floor(Math.random() * employees.length)];
    const template = reportTypes[i % 2];
    reportsData.push({
      userId: reporter.id,
      type: template.type,
      title: template.title,
      description: template.desc,
      severity: template.severity,
      status: "resolved",
      location: "Kitchen",
      resolvedBy: reporter.managerId,
      resolvedAt: new Date(),
      createdAt: new Date()
    });
  }
  await db.insert(reports).values(reportsData);

  // =========================================================================
  // 5. ATTENDANCE & PAYSLIP GENERATION (12 Months History)
  // =========================================================================
  
  console.log("Generating attendance and payslips for 12 months...");
  
  const now = new Date(); // Assume running today
  const periods = [];

  // Generate 24 periods (12 months x 2 periods) going backwards
  for (let i = 0; i < 12; i++) {
     const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
     const m = d.getMonth();
     const y = d.getFullYear();
     const lastDay = new Date(y, m + 1, 0).getDate();

     // Period 2 (16-End)
     periods.push({ month: m, year: y, startDay: 16, endDay: lastDay, periodNum: 2 });
     // Period 1 (1-15)
     periods.push({ month: m, year: y, startDay: 1, endDay: 15, periodNum: 1 });
  }
  // Reverse to insert chronologically (oldest first)
  periods.reverse();

  const payslipsToInsert = [];
  
  for (const emp of allStaff) {
    
    // Process each period for this employee
    for (const p of periods) {
        let periodRegHours = 0;
        let periodOtHours = 0;
        let periodNdHours = 0;
        
        let periodRegHolidayHours = 0;
        let periodRegHolidayOtHours = 0;
        let periodSpecHolidayHours = 0;
        let periodSpecHolidayOtHours = 0;

        // Loop days in this period
        for (let d = p.startDay; d <= p.endDay; d++) {
            const workDate = new Date(p.year, p.month, d);
            
            // Skip Sundays only
            if (workDate.getDay() === 0) continue;

            // 90% Attendance Rate
            if (Math.random() > 0.1) {
                // Determine Shift
                const isMorning = Math.random() > 0.4;
                const start = new Date(workDate);
                start.setHours(isMorning ? 8 : 16, 0, 0, 0);
                
                const end = new Date(workDate);
                if (isMorning) {
                    end.setHours(17, 0, 0, 0); // 5PM
                } else {
                    end.setHours(1, 0, 0, 0); // 1AM next day
                    end.setDate(end.getDate() + 1);
                }

                // Add Variance
                const timeIn = new Date(start);
                timeIn.setMinutes(timeIn.getMinutes() + (Math.random() * 30 - 15));
                
                const timeOut = new Date(end);
                timeOut.setMinutes(timeOut.getMinutes() + (Math.random() * 45)); 

                // Calculate durations
                const durationMs = timeOut.getTime() - timeIn.getTime();
                const totalMinutes = Math.floor(durationMs / 60000);
                const breakMinutes = 60;
                const workMinutes = Math.max(0, totalMinutes - breakMinutes);

                // Insert Attendance (Only fetch IDs for current/recent month to save DB ops for old history if performance is key, but here we insert all)
                const [att] = await db.insert(attendance).values({
                    userId: emp.id,
                    date: workDate,
                    timeIn: timeIn,
                    timeOut: timeOut,
                    status: "clocked_out",
                    totalBreakMinutes: breakMinutes,
                    totalWorkMinutes: workMinutes,
                    notes: "Regular shift"
                }).returning();

                await db.insert(breaks).values({
                    attendanceId: att.id,
                    userId: emp.id,
                    breakStart: new Date(timeIn.getTime() + 4 * 3600000), 
                    breakEnd: new Date(timeIn.getTime() + 5 * 3600000),
                    breakMinutes: 60,
                    breakType: "lunch",
                    notes: "Lunch"
                });

                // --- Hour Classification Logic ---
                let dailyReg = 0;
                let dailyOT = 0;
                
                if (workMinutes > 480) { 
                    dailyReg = 480;
                    dailyOT = workMinutes - 480;
                } else {
                    dailyReg = workMinutes;
                }
                
                const ndHrs = getNightDiffHours(timeIn, timeOut);
                periodNdHours += ndHrs;

                // Check for Holiday
                let isRegHoliday = false;
                let isSpecHoliday = false;

                if (SHOW_HOLIDAY_FEATURES) {
                   const hType = getHolidayType(workDate, holidayList);
                   if (hType === 'regular') isRegHoliday = true;
                   if (hType === 'special') isSpecHoliday = true;
                }

                if (isRegHoliday) {
                    periodRegHolidayHours += (dailyReg / 60);
                    periodRegHolidayOtHours += (dailyOT / 60);
                } else if (isSpecHoliday) {
                    periodSpecHolidayHours += (dailyReg / 60);
                    periodSpecHolidayOtHours += (dailyOT / 60);
                } else {
                    periodRegHours += (dailyReg / 60);
                    periodOtHours += (dailyOT / 60);
                }
            }
        }

        // --- Calculate Payslip for this Period ---
        const basicSalary = periodRegHours * HOURLY_RATE;
        const overtimePay = periodOtHours * (HOURLY_RATE * OT_MULTIPLIER);
        const nightDiffPay = periodNdHours * (HOURLY_RATE * ND_MULTIPLIER);
        
        let holidayPay = 0;
        if (SHOW_HOLIDAY_FEATURES) {
             holidayPay += (periodRegHolidayHours * HOURLY_RATE * REG_HOLIDAY_MULTIPLIER);
             holidayPay += (periodRegHolidayOtHours * HOURLY_RATE * REG_HOLIDAY_OT_MULTIPLIER);
             holidayPay += (periodSpecHolidayHours * HOURLY_RATE * SPL_HOLIDAY_MULTIPLIER);
             holidayPay += (periodSpecHolidayOtHours * HOURLY_RATE * SPL_HOLIDAY_OT_MULTIPLIER);
        }

        const allowanceAmount = 1000; 
        const grossPay = basicSalary + overtimePay + nightDiffPay + holidayPay + allowanceAmount;

        // Deductions
        const sss = computeSSS(grossPay);
        const philHealth = computePhilHealth(grossPay);
        const pagIbig = computePagIbig(grossPay);
        const totalDeductions = sss + philHealth + pagIbig;
        const netPay = Math.max(0, grossPay - totalDeductions);

        payslipsToInsert.push({
            userId: emp.id,
            month: p.month + 1,
            year: p.year,
            period: p.periodNum,
            basicSalary: Math.round(basicSalary * 100),
            allowances: {
                overtime: Math.round(overtimePay * 100),
                nightDiff: Math.round(nightDiffPay * 100),
                holidayPay: Math.round(holidayPay * 100),
                allowances: Math.round(allowanceAmount * 100),
                // Store raw hours for reference if needed
                regHolidayHours: periodRegHolidayHours,
                specHolidayHours: periodSpecHolidayHours
            },
            deductions: {
                sss: Math.round(sss * 100),
                philHealth: Math.round(philHealth * 100),
                pagIbig: Math.round(pagIbig * 100),
                tax: 0
            },
            grossPay: Math.round(grossPay * 100),
            netPay: Math.round(netPay * 100),
            generatedAt: new Date()
        });
    }
  }

  // Bulk insert to avoid memory issues if too large, but 12 staff * 24 periods = ~288 records is fine
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
      
      const isMorning = Math.random() > 0.5;
      const start = new Date(workDate);
      start.setHours(isMorning ? 8 : 16, 0, 0, 0);
      
      const end = new Date(workDate);
      if (isMorning) end.setHours(16, 0, 0, 0);
      else end.setHours(23, 59, 0, 0);

      shiftData.push({
        userId: emp.id,
        date: workDate,
        startTime: start,
        endTime: end,
        type: isMorning ? "morning" : "afternoon",
        title: isMorning ? "Morning Shift" : "Afternoon Shift",
        shiftRole: emp.position || "Staff",
        location: emp.department === 'Kitchen' ? 'Kitchen' : 'Main Hall'
      });
    }
  }
  await db.insert(schedules).values(shiftData);

  // 7. Analytics Data (12 Months)
  console.log("Generating analytics...");
  const laborData = [];
  
  // Aggregate payslips by month/year
  const payrollByMonth = payslipsToInsert.reduce((acc: any, p: any) => {
      const key = `${p.year}-${p.month}`;
      if (!acc[key]) acc[key] = 0;
      acc[key] += p.grossPay;
      return acc;
  }, {});

  for (const [key, totalCost] of Object.entries(payrollByMonth)) {
     const [y, m] = key.split('-');
     const laborCents = totalCost as number;
     const monthSales = (laborCents / 100) * 4; // 25% cost ratio
     
     laborData.push({
       month: parseInt(m),
       year: parseInt(y),
       totalSales: Math.round(monthSales * 100),
       totalLaborCost: laborCents,
       laborCostPercentage: 2500,
       status: "Excellent",
       performanceRating: "A",
       notes: "Seed Data"
     });
  }
  await db.insert(laborCostData).values(laborData);

  console.log("Seed completed successfully!");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});