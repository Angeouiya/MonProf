import assert from "node:assert/strict";
import path from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") } });
const { findTeacherScheduleConflict, formatTeacherScheduleConflictMessage } = jiti("../src/lib/teacher-schedule-conflicts.ts");
const teacherId = "teacher-schedule-completeness";
const dates = Array.from({ length: 6 }, (_, index) => new Date(Date.UTC(2026, 10, 5 + index)));
const requestedSlots = dates.map((scheduledDate) => ({
  scheduledDate, scheduledTime: "21:00", durationMinutes: 60,
  courseFormat: "ONLINE", commune: null, quartier: null,
}));
const historicalSlots = dates.slice(0, 5).flatMap((scheduledDate) =>
  Array.from({ length: 10 }, (_, index) => ({
    scheduledDate, scheduledTime: `${String(index + 8).padStart(2, "0")}:00`,
    durationMinutes: 60, courseFormat: "ONLINE", commune: null, quartier: null,
  })),
);
const fiftyFirst = { ...requestedSlots[5] };

function clientFor(source, rows) {
  const findMany = (name) => async (args) => {
    assert.equal(args.take, undefined, `${name} ne doit pas tronquer les conflits après 50 cours`);
    if (name === "booking" && source === "booking") {
      assert.ok(Array.isArray(args.where.AND) && args.where.AND.length === 2);
      assert.ok(Array.isArray(args.where.AND[0].OR), "Le filtre des dates doit rester combiné avec la preuve de paiement");
      assert.ok(Array.isArray(args.where.AND[1].OR), "La preuve Jèko/PayDunya doit rester appliquée");
    }
    return name === source ? rows : [];
  };
  return {
    bookingSession: { findMany: findMany("bookingSession") },
    booking: { findMany: findMany("booking") },
    marketplaceRequest: { findMany: findMany("marketplaceRequest") },
    managedCourseSession: { findMany: findMany("managedCourseSession") },
  };
}

const paidBooking = { reference: "PAYÉ", status: "PAID", paymentStatus: "RECEIVED",
  courseFormat: "ONLINE", commune: null, quartier: null, transportFeeKey: null };
const sessions = [...historicalSlots, fiftyFirst].map((slot, index) => ({
  id: `session-${index + 1}`, bookingId: `booking-${index + 1}`, sequence: 1,
  status: "PLANNED", ...slot, booking: paidBooking,
}));
const sessionConflict = await findTeacherScheduleConflict(clientFor("bookingSession", sessions), { teacherId, slots: requestedSlots });
assert.equal(sessionConflict?.bookingSessionId, "session-51");

const bookings = [...historicalSlots, fiftyFirst].map((slot, index) => ({
  id: `booking-${index + 1}`, reference: `B-${index + 1}`,
  status: "PAID", paymentStatus: "RECEIVED", preferredTime: null,
  transportFeeKey: null, ...slot,
}));
const bookingConflict = await findTeacherScheduleConflict(clientFor("booking", bookings), { teacherId, slots: requestedSlots });
assert.equal(bookingConflict?.bookingId, "booking-51");
assert.doesNotMatch(formatTeacherScheduleConflictMessage(bookingConflict), /B-51/);

const previousFlag = process.env.MARKETPLACE_V2_ENABLED;
try {
  const missions = [...historicalSlots, fiftyFirst].map((slot, index) => ({
    id: `mission-${index + 1}`, reference: `MC-${index + 1}`, status: "ACCEPTED", ...slot,
  }));
  for (const flag of ["true", "false"]) {
    process.env.MARKETPLACE_V2_ENABLED = flag;
    const missionConflict = await findTeacherScheduleConflict(clientFor("marketplaceRequest", missions), { teacherId, slots: requestedSlots });
    assert.equal(missionConflict?.bookingId, "mission-51", `Une mission acceptée doit bloquer le planning même avec le flag V2=${flag}`);
  }
} finally {
  if (previousFlag === undefined) delete process.env.MARKETPLACE_V2_ENABLED;
  else process.env.MARKETPLACE_V2_ENABLED = previousFlag;
}

const managedRows = [...historicalSlots, fiftyFirst].map((slot, index) => ({
  id: `managed-${index + 1}`, sequence: index + 1, status: "PLANNED", ...slot,
  dossier: { reference: `AC-${index + 1}`, courseFormat: slot.courseFormat, commune: null, quartier: null },
}));
const managedConflict = await findTeacherScheduleConflict(clientFor("managedCourseSession", managedRows), { teacherId, slots: requestedSlots });
assert.equal(managedConflict?.bookingId, "managed-51");
assert.equal(managedConflict?.paymentStatus, "MANUAL_COMPETENCE");
console.log("Planning professeur : conflits V1/V2 et service accompagné au-delà du 50e cours vérifiés.");
