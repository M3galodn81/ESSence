import { db } from "../../server/db";
import { schedules } from "../../shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { addDays, setHours, setMinutes, format } from "date-fns";
import { user_id } from "./seed";

// Configuration
const USER_ID = user_id;
const START_DATE = new Date("2025-11-01");
const END_DATE = new Date("2025-11-25");
const SHIFT_TYPES = ["morning", "afternoon", "night"] as const;
const ROLES = ["cashier", "server", "bar", "kitchen"] as const;

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
  console.log("------------------------------------------------");
  console.log("Seeding Random Schedules for:", USER_ID);
  console.log("------------------------------------------------");

  // 1. Clean up existing schedules
  await db.delete(schedules).where(
    and(
      eq(schedules.userId, USER_ID),
      gte(schedules.date, new Date(START_DATE.getTime())),
      lte(schedules.date, new Date(END_DATE.getTime()))
    )
  );

  let currentDate = START_DATE;

  while (currentDate <= END_DATE) {
    // Skip Weekends
    const day = currentDate.getDay();
    if (day !== 0 && day !== 6) {
      
      const dateStr = format(currentDate, "yyyy-MM-dd");
      
      // Randomize Shift
      const shiftType = SHIFT_TYPES[getRandomInt(0, SHIFT_TYPES.length - 1)];
      const shiftRole = ROLES[getRandomInt(0, ROLES.length - 1)];
      
      let startHour = 8;
      let endHour = 16;

      if (shiftType === "morning") { startHour = 8; endHour = 16; }
      else if (shiftType === "afternoon") { startHour = 16; endHour = 0; } // 0 = Midnight
      else if (shiftType === "night") { startHour = 0; endHour = 8; }

      const shiftDate = setHours(setMinutes(currentDate, 0), 0);
      const startTime = setMinutes(setHours(currentDate, startHour), 0);
      
      // Handle overnight shifts (endTime is next day)
      let endTime = setMinutes(setHours(currentDate, endHour), 0);
      if (endHour < startHour || (endHour === 0 && startHour !== 0)) {
         endTime = addDays(endTime, 1);
      }

      console.log(`  ${dateStr}: ${shiftType.toUpperCase()} (${shiftRole})`);

      await db.insert(schedules).values({
        userId: USER_ID,
        date: shiftDate,
        startTime: startTime,
        endTime: endTime,
        type: shiftType,
        title: `${shiftType.charAt(0).toUpperCase() + shiftType.slice(1)} Shift`,
        description: `Randomly seeded ${shiftType} shift`,
        location: "Main Branch",
        shiftRole: shiftRole,
        isAllDay: false,
        status: "scheduled"
      });
    }
    currentDate = addDays(currentDate, 1);
  }

  console.log("------------------------------------------------");
  console.log("Schedule Seeding Complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});