import fs from "node:fs";
import { createJiti } from "jiti";
import { PrismaClient } from "@prisma/client";

const jiti = createJiti(import.meta.url);
const {
  getExpectedClientPaymentAmount,
  getVerifiedPayDunyaClientPaymentTransaction,
  hasCompletedPayDunyaProof,
  hasVerifiedClientFunds,
  isOperationalBookingStatus,
} = jiti("../src/lib/payment-security.ts");

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

function quarantineReason(booking) {
  const expected = getExpectedClientPaymentAmount(booking);
  const tx = getVerifiedPayDunyaClientPaymentTransaction(booking);
  const anyClientPayment = booking.transactions.find((transaction) => (
    transaction.type === "CLIENT_PAYMENT"
    && hasVerifiedClientFunds(transaction.status)
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
    teacherTasks: {
      where: { status: { in: ["TODO", "SENT_TO_TEACHER", "SEEN_BY_TEACHER", "IN_PROGRESS", "LATE"] } },
    },
    missionLinks: {
      where: { status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] } },
    },
  },
  orderBy: { createdAt: "desc" },
});

const suspects = bookings
  .map((booking) => ({ booking, reason: quarantineReason(booking) }))
  .filter(({ booking, reason }) => hasVerifiedClientFunds(booking.paymentStatus) && reason);
const operationalArtifactsWithoutProof = bookings
  .map((booking) => ({ booking, reason: quarantineReason(booking) }))
  .filter(({ booking, reason }) => reason && (booking.teacherTasks.length > 0 || booking.missionLinks.length > 0));

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
  disabledOperationalArtifacts: operationalArtifactsWithoutProof.map(({ booking, reason }) => ({
    reference: booking.reference,
    id: booking.id,
    teacherTasks: booking.teacherTasks.length,
    missionLinks: booking.missionLinks.length,
    reason,
  })),
};

if (apply && (suspects.length > 0 || operationalArtifactsWithoutProof.length > 0)) {
  const now = new Date();
  for (const { booking, reason } of suspects) {
    const nextStatus = isOperationalBookingStatus(booking.status) ? "PENDING_PAYMENT" : booking.status;
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

  for (const { booking, reason } of operationalArtifactsWithoutProof) {
    const detail = `Désactivation opérationnelle anti-faux paiement sur ${booking.reference}: ${reason}. Aucune tâche ou mission professeur ne doit rester active sans confirmation PayDunya serveur.`;

    await prisma.$transaction(async (tx) => {
      await tx.teacherTask.updateMany({
        where: {
          bookingId: booking.id,
          status: { in: ["TODO", "SENT_TO_TEACHER", "SEEN_BY_TEACHER", "IN_PROGRESS", "LATE"] },
        },
        data: {
          status: "CANCELLED",
          completedAt: now,
        },
      });

      await tx.teacherMissionLink.updateMany({
        where: {
          bookingId: booking.id,
          status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
        },
        data: {
          status: "EXPIRED",
          response: detail,
        },
      });

      await tx.teacherNotification.updateMany({
        where: {
          bookingId: booking.id,
          status: { in: ["DRAFT", "PENDING", "SENT"] },
        },
        data: {
          status: "FAILED",
          sent: false,
        },
      });

      await tx.notification.create({
        data: {
          userId: null,
          title: "Mission professeur désactivée sans PayDunya",
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
          action: "Désactivation mission sans preuve PayDunya",
          entityType: "Booking",
          entityId: booking.id,
          detail,
          oldStatus: "ACTIVE_TEACHER_ARTIFACTS",
          newStatus: "DISABLED_UNVERIFIED_PAYMENT",
        },
      });
    });
  }
}

console.log(JSON.stringify(report, null, 2));

await prisma.$disconnect();
process.exitCode = suspects.length > 0 && !apply ? 1 : 0;
