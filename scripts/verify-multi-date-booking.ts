import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBookingSessionRows } from "../src/lib/booking-sessions";
import {
  calculateBookingPricing,
  getAutomaticPackProgress,
  resolveAutomaticPackType,
} from "../src/lib/pricing";

assert.equal(resolveAutomaticPackType(1), "SINGLE");
assert.equal(resolveAutomaticPackType(3), "SINGLE");
assert.equal(resolveAutomaticPackType(4), "PACK_4");
assert.equal(resolveAutomaticPackType(7), "PACK_4");
assert.equal(resolveAutomaticPackType(8), "PACK_8");
assert.equal(resolveAutomaticPackType(11), "PACK_8");
assert.equal(resolveAutomaticPackType(12), "PACK_12");
assert.equal(resolveAutomaticPackType(25), "PACK_12");

function professionalPricing(sessionsCount: number) {
  return calculateBookingPricing({
    category: "formation_professionnelle",
    schoolSystem: "professionnel",
    deliveryMode: "en_ligne",
    packType: resolveAutomaticPackType(sessionsCount),
    sessionsCount,
  });
}

const fiveSessions = professionalPricing(5);
assert.equal(fiveSessions.numberOfSessions, 5);
assert.equal(fiveSessions.courseAmount, 200_000);

const nineSessions = professionalPricing(9);
assert.equal(nineSessions.numberOfSessions, 9);
assert.equal(nineSessions.rawCourseAmount, 360_000);
assert.equal(nineSessions.discountAmount, 18_000);
assert.equal(nineSessions.courseAmount, 342_000);

const thirteenSessions = professionalPricing(13);
assert.equal(thirteenSessions.numberOfSessions, 13);
assert.equal(thirteenSessions.rawCourseAmount, 520_000);
assert.equal(thirteenSessions.discountAmount, 36_400);
assert.equal(thirteenSessions.courseAmount, 483_600);

const progress = getAutomaticPackProgress(9);
assert.equal(progress.packType, "PACK_8");
assert.equal(progress.nextPackType, "PACK_12");
assert.equal(progress.sessionsUntilNextPack, 3);

const rows = buildBookingSessionRows({
  bookingId: "booking-multi-date",
  teacherId: "teacher-multi-date",
  sessionsCount: 3,
  startDate: new Date(2026, 7, 18),
  selectedTimeSlots: [],
  scheduleOccurrences: [
    { scheduledDate: new Date(2026, 7, 18), scheduledTime: "Mardi 08h00 - 10h00", durationMinutes: 120 },
    { scheduledDate: new Date(2026, 7, 21), scheduledTime: "Vendredi 14h00 - 16h00", durationMinutes: 120 },
    { scheduledDate: new Date(2026, 7, 24), scheduledTime: "18h30 - 19h30", durationMinutes: 60 },
  ],
  courseAmount: 100_001,
  commissionAmount: 30_001,
  teacherPayoutAmount: 70_000,
  transportFee: 3_000,
});
assert.equal(rows.length, 3);
assert.deepEqual(rows.map((row) => row.durationMinutes), [120, 120, 60]);
assert.deepEqual(rows.map((row) => row.scheduledTime), [
  "Mardi 08h00 - 10h00",
  "Vendredi 14h00 - 16h00",
  "18h30 - 19h30",
]);
assert.equal(rows.reduce((total, row) => total + (row.courseAmount ?? 0), 0), 100_001);
assert.equal(rows.reduce((total, row) => total + (row.transportFee ?? 0), 0), 3_000);

const bookingForm = readFileSync("src/app/client/reserver/reserver-form.tsx", "utf8");
assert.match(bookingForm, /scheduleOccurrences:\s*scheduleRows\.map/);
assert.match(bookingForm, /data-next-pack-nudge/);
assert.match(bookingForm, /Ajouter une autre date/);
assert.match(bookingForm, /La meilleure réduction déjà atteinte est appliquée automatiquement/);

const bookingApi = readFileSync("src/app/api/bookings/route.ts", "utf8");
assert.match(bookingApi, /usesExplicitSchedule/);
assert.match(bookingApi, /resolveAutomaticPackType\(requestedSessionsCount\)/);
assert.match(bookingApi, /scheduleSlotsOverlap/);
assert.match(bookingApi, /scheduleOccurrences:\s*usesExplicitSchedule/);

console.log("OK multi-date booking: dates explicites, sessions atomiques et meilleur pack atteint vérifiés.");
