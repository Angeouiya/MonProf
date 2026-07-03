import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  if (!fs.existsSync(".env")) return;

  const env = fs.readFileSync(".env", "utf8");
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.startsWith("DATABASE_URL=")) continue;
    process.env.DATABASE_URL = trimmed.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
    return;
  }
}

loadDatabaseUrl();

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const verifiedStatuses = new Set([
  "RECEIVED",
  "BLOCKED",
  "VALIDATED",
  "TO_PAY_TEACHER",
  "TEACHER_PAID",
  "DISPUTED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "RETAINED",
]);

const operationalPaidStatuses = new Set([
  "PAID",
  "PENDING_ADMIN_VALIDATION",
  "CONFIRMED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COURSE_DONE",
  "PENDING_CLIENT_VALIDATION",
  "VALIDATED_BY_CLIENT",
  "PAYMENT_TO_RELEASE",
  "TEACHER_PAID",
  "DISPUTED",
]);

function expectedAmount(booking) {
  return booking.totalClientPays > 0 ? booking.totalClientPays : booking.totalPrice || 0;
}

function hasCompletedPayDunyaProof(booking) {
  return Boolean(booking.paydunyaVerifiedAt) && String(booking.paydunyaStatus || "").toUpperCase() === "COMPLETED";
}

function verifiedClientPayment(booking) {
  const expected = expectedAmount(booking);
  if (expected <= 0) return null;
  return booking.transactions.find((transaction) => (
    transaction.type === "CLIENT_PAYMENT"
    && verifiedStatuses.has(transaction.status)
    && transaction.amount === expected
  ));
}

function quarantineReason(booking) {
  const expected = expectedAmount(booking);
  const tx = verifiedClientPayment(booking);
  const anyClientPayment = booking.transactions.find((transaction) => (
    transaction.type === "CLIENT_PAYMENT"
    && verifiedStatuses.has(transaction.status)
    && transaction.amount > 0
  ));
  const reasons = [];
  if (!tx) reasons.push(`aucune transaction client vérifiée >= ${expected} FCFA`);
  if (anyClientPayment && anyClientPayment.amount !== expected) {
    reasons.push(`montant transaction ${anyClientPayment.amount} FCFA différent du total attendu ${expected} FCFA`);
  }
  if (!hasCompletedPayDunyaProof(booking)) {
    reasons.push("preuve PayDunya serveur absente ou incomplète");
  }
  return reasons.join("; ");
}

const bookings = await prisma.booking.findMany({
  include: {
    transactions: { where: { type: { in: ["CLIENT_PAYMENT", "TEACHER_PAYOUT"] } } },
  },
  orderBy: { createdAt: "desc" },
});

const suspects = bookings
  .map((booking) => ({ booking, reason: quarantineReason(booking) }))
  .filter(({ booking, reason }) => verifiedStatuses.has(booking.paymentStatus) && reason);

const report = {
  mode: apply ? "apply" : "dry-run",
  inspectedBookings: bookings.length,
  quarantined: suspects.map(({ booking, reason }) => ({
    reference: booking.reference,
    id: booking.id,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    reason,
  })),
};

if (apply && suspects.length > 0) {
  const now = new Date();
  for (const { booking, reason } of suspects) {
    const nextStatus = operationalPaidStatuses.has(booking.status) ? "PENDING_PAYMENT" : booking.status;
    const detail = `Quarantaine anti-faux paiement sur ${booking.reference}: ${reason}. Aucun flux financier ne doit être déclenché sans confirmation PayDunya serveur.`;

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: nextStatus,
          paymentStatus: "FAILED",
          paydunyaStatus: "REJECTED",
          paydunyaVerifiedAt: null,
          paydunyaReceiptUrl: null,
          paydunyaFailureReason: detail,
          paydunyaLastCheckedAt: now,
          paydunyaLastPayload: JSON.stringify({
            source: "quarantine-unverified-payments",
            previousStatus: booking.status,
            previousPaymentStatus: booking.paymentStatus,
            reason,
          }),
          teacherPaidAmount: 0,
          teacherPaidAt: null,
        },
      });

      await tx.transaction.updateMany({
        where: {
          bookingId: booking.id,
          type: { in: ["CLIENT_PAYMENT", "TEACHER_PAYOUT"] },
        },
        data: {
          status: "FAILED",
          paidAt: null,
        },
      });

      await tx.notification.create({
        data: {
          userId: null,
          title: "Paiement sans preuve mis en quarantaine",
          message: detail,
          type: "PAYMENT_VERIFICATION_FAILED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: "CRITICAL",
          bookingId: booking.id,
          teacherId: booking.teacherId,
          clientId: booking.clientId,
          sentAt: now,
          link: `/admin/reservations/${booking.id}`,
          actionLabel: "Vérifier le dossier",
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminId: null,
          action: "Quarantaine paiement sans preuve PayDunya",
          entityType: "Booking",
          entityId: booking.id,
          detail,
          oldStatus: `${booking.status}/${booking.paymentStatus}`,
          newStatus: `${nextStatus}/FAILED`,
        },
      });
    });
  }
}

console.log(JSON.stringify(report, null, 2));

await prisma.$disconnect();
process.exitCode = suspects.length > 0 && !apply ? 1 : 0;
