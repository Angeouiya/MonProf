import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function sum(rows, key) {
  return rows.reduce((total, row) => total + Math.max(0, row[key] || 0), 0);
}

async function main() {
  const [bookings, missingSessionRows] = await Promise.all([db.booking.findMany({
    where: { sessions: { some: {} } },
    select: {
      id: true,
      reference: true,
      sessionsCount: true,
      courseAmount: true,
      commissionAmount: true,
      teacherPayoutAmount: true,
      transportFee: true,
      teacherNetAmount: true,
      sessions: true,
    },
  }), db.booking.count({ where: { sessions: { none: {} } } })]);

  const failures = [];
  if (missingSessionRows > 0) failures.push(`${missingSessionRows} réservation(s) sans grand livre de séances.`);
  for (const booking of bookings) {
    const checks = [
      ["nombre de séances", booking.sessions.length, Math.max(1, booking.sessionsCount)],
      ["montant cours", sum(booking.sessions, "courseAmount"), booking.courseAmount],
      ["commission", sum(booking.sessions, "commissionAmount"), booking.commissionAmount],
      ["part professeur", sum(booking.sessions, "teacherCourseAmount"), booking.teacherPayoutAmount],
      ["déplacement", sum(booking.sessions, "transportFee"), booking.transportFee],
      ["net professeur", sum(booking.sessions, "teacherNetAmount"), booking.teacherNetAmount],
    ];
    for (const [label, actual, expected] of checks) {
      if (actual !== expected) failures.push(`${booking.reference}: ${label} ${actual} != ${expected}`);
    }
    for (const session of booking.sessions) {
      if (session.paidAmount > session.releasedAmount) {
        failures.push(`${booking.reference} séance ${session.sequence}: payé supérieur au libéré`);
      }
      if (session.releasedAmount > session.teacherNetAmount) {
        failures.push(`${booking.reference} séance ${session.sequence}: libéré supérieur au net`);
      }
    }
  }

  if (failures.length > 0) {
    console.error(failures.slice(0, 50).join("\n"));
    throw new Error(`${failures.length} incohérence(s) de comptabilité séance détectée(s).`);
  }
  console.log(`OK Comptabilité par séance vérifiée sur ${bookings.length} réservation(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
