import { db } from "../../server/db";
import { attendance, breaks } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { addDays, setHours, setMinutes, format, addMinutes } from "date-fns";
import { user_id } from "./seed";

const USER_ID = user_id;
const START_DATE = new Date("2025-11-01");
const END_DATE = new Date("2025-11-25");

// Helper to get random integer between min and max (inclusive)
function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
  console.log("------------------------------------------------");
  console.log("Seeding Attendance: Random 8-10h Work + Random Break");
  console.log("User:", USER_ID);
  console.log("------------------------------------------------");

  // Clear previous data to avoid duplicates
  await db.delete(breaks).where(eq(breaks.userId, USER_ID));
  await db.delete(attendance).where(eq(attendance.userId, USER_ID));

  let currentDate = START_DATE;

  while (currentDate <= END_DATE) {
    // Skip Weekends
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      const dateStr = format(currentDate, "yyyy-MM-dd");

      // 1. Randomize Shift Start (Morning/Afternoon/Night)
      // 8:00 AM, 4:00 PM (16:00), or 12:00 AM (00:00)
      const startOpts = [8, 16, 0]; 
      const startHour = startOpts[getRandomInt(0, 2)];
      
      // Add slight variance to start time (+/- 15 mins) to look realistic
      const varianceIn = getRandomInt(-15, 15);
      const timeIn = addMinutes(setMinutes(setHours(currentDate, startHour), 0), varianceIn);

      // 2. Randomized Break (30 to 60 minutes)
      const breakDuration = getRandomInt(30, 60); 
      
      // Break starts roughly 4 hours after shift start + variance
      const breakStart = addMinutes(timeIn, 4 * 60 + getRandomInt(-20, 20));
      const breakEnd = addMinutes(breakStart, breakDuration);

      // 3. Randomized Work Duration (8 to 10 hours)
      // 8 hours = 480 mins, 10 hours = 600 mins
      const targetWorkMinutes = getRandomInt(480, 600);
      
      // Total time on site = Work Time + Break Time
      const totalShiftDuration = targetWorkMinutes + breakDuration; 
      const timeOut = addMinutes(timeIn, totalShiftDuration);

      // Format for logging
      const workH = Math.floor(targetWorkMinutes / 60);
      const workM = targetWorkMinutes % 60;

      console.log(`  ${dateStr}: In ${format(timeIn, "HH:mm")} | Out ${format(timeOut, "HH:mm")} | Work ${workH}h ${workM}m | Break ${breakDuration}m`);

      // Insert Attendance
      const [att] = await db.insert(attendance).values({
        userId: USER_ID,
        date: timeIn,
        timeIn: timeIn,
        timeOut: timeOut,
        status: 'clocked_out',
        totalBreakMinutes: breakDuration,
        totalWorkMinutes: targetWorkMinutes, 
        notes: `Seeded Shift (${workH}h ${workM}m work)`
      }).returning();

      // Insert Break
      await db.insert(breaks).values({
        attendanceId: att.id,
        userId: USER_ID,
        breakStart: breakStart,
        breakEnd: breakEnd,
        breakMinutes: breakDuration,
        breakType: 'lunch',
        notes: 'Meal Break'
      });
    }
    currentDate = addDays(currentDate, 1);
  }

  console.log("------------------------------------------------");
  console.log("Attendance Seeding Complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});