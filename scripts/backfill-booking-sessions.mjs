import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

function distribute(total, count) {
  const safeTotal = Math.max(0, Math.round(total || 0));
  const safeCount = Math.max(1, Math.round(count || 1));
  const base = Math.floor(safeTotal / safeCount);
  const remainder = safeTotal - base * safeCount;
  return Array.from({ length: safeCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function sessionStatus(booking) {
  if (booking.status === "REFUNDED") return "REFUNDED";
  if (booking.status === "CANCELLED") return "CANCELLED";
  if (booking.paymentStatus === "TEACHER_PAID" || booking.status === "TEACHER_PAID") return "PAID";
  if (booking.paymentStatus === "TO_PAY_TEACHER" || booking.status === "PAYMENT_TO_RELEASE") return "RELEASED";
  if (booking.status === "PENDING_CLIENT_VALIDATION") return "AWAITING_CLIENT_CONFIRMATION";
  if (booking.status === "IN_PROGRESS") return "IN_PROGRESS";
  if (["ASSIGNED", "CONFIRMED"].includes(booking.status)) return "TEACHER_CONFIRMED";
  return "PLANNED";
}

async function main() {
  const bookings = await db.booking.findMany({
    where: { sessions: { none: {} } },
    orderBy: { createdAt: "asc" },
  });

  let rows = 0;
  for (const booking of bookings) {
    const count = Math.max(1, booking.sessionsCount || 1);
    const status = sessionStatus(booking);
    const courseAmounts = distribute(booking.courseAmount, count);
    const commissions = distribute(booking.commissionAmount, count);
    const teacherCourses = distribute(booking.teacherPayoutAmount, count);
    const transports = distribute(booking.transportFee, count);
    const released = distribute(
      ["RELEASED", "PARTIALLY_PAID", "PAID"].includes(status) ? booking.teacherNetAmount : 0,
      count,
    );
    const paid = distribute(status === "PAID" ? booking.teacherPaidAmount || booking.teacherNetAmount : booking.teacherPaidAmount, count);
    const firstDate = booking.scheduledDate || booking.startDate || booking.createdAt;
    const data = Array.from({ length: count }, (_, index) => {
      const scheduledDate = new Date(firstDate);
      scheduledDate.setDate(scheduledDate.getDate() + index * 7);
      const teacherNetAmount = teacherCourses[index] + transports[index];
      return {
        bookingId: booking.id,
        sequence: index + 1,
        teacherId: booking.teacherId,
        scheduledDate,
        scheduledTime: booking.scheduledTime || booking.preferredTime,
        durationMinutes: 120,
        status,
        courseAmount: courseAmounts[index],
        commissionAmount: commissions[index],
        teacherCourseAmount: teacherCourses[index],
        transportFee: transports[index],
        teacherNetAmount,
        releasedAmount: Math.min(teacherNetAmount, released[index]),
        paidAmount: Math.min(teacherNetAmount, paid[index]),
        completedAt: ["AWAITING_CLIENT_CONFIRMATION", "RELEASED", "PARTIALLY_PAID", "PAID"].includes(status)
          ? booking.courseDoneAt || booking.updatedAt
          : null,
        clientValidatedAt: ["RELEASED", "PARTIALLY_PAID", "PAID"].includes(status)
          ? booking.clientValidatedAt || booking.updatedAt
          : null,
        releasedAt: ["RELEASED", "PARTIALLY_PAID", "PAID"].includes(status)
          ? booking.clientValidatedAt || booking.updatedAt
          : null,
        paidAt: status === "PAID" ? booking.teacherPaidAt || booking.updatedAt : null,
        cancelledAt: ["CANCELLED", "REFUNDED"].includes(status) ? booking.cancelledAt || booking.updatedAt : null,
      };
    });
    rows += data.length;
    if (apply) {
      await db.bookingSession.createMany({ data, skipDuplicates: true });
    }
  }

  console.log(`${apply ? "APPLY" : "DRY-RUN"} ${bookings.length} réservation(s), ${rows} séance(s) à créer.`);
  if (!apply && bookings.length > 0) {
    console.log("Relancez avec --apply après validation du schéma.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
