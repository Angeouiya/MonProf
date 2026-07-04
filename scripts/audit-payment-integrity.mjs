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
]);

function hasPayDunyaProof(booking) {
  return booking.paydunyaVerifiedAt && String(booking.paydunyaStatus || "").toUpperCase() === "COMPLETED";
}

function expectedAmount(booking) {
  return booking.totalClientPays > 0 ? booking.totalClientPays : booking.totalPrice || 0;
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

const bookings = await prisma.booking.findMany({
  include: {
    transactions: { where: { type: "CLIENT_PAYMENT" } },
  },
  orderBy: { createdAt: "desc" },
});

const report = {
  totalBookings: bookings.length,
  paidWithoutVerifiedTransaction: [],
  amountMismatch: [],
  completedWithoutVerifiedAt: [],
  verifiedStatusWithoutPayDunyaProof: [],
  operationalStatusWithoutVerifiedFunds: [],
};

for (const booking of bookings) {
  const expected = expectedAmount(booking);
  const verifiedTx = verifiedClientPayment(booking);

  if (verifiedStatuses.has(booking.paymentStatus) && !verifiedTx) {
    report.paidWithoutVerifiedTransaction.push({
      reference: booking.reference,
      id: booking.id,
      paymentStatus: booking.paymentStatus,
      expectedAmount: expected,
    });
  }

  const anyVerifiedTx = booking.transactions.find((transaction) => (
    transaction.type === "CLIENT_PAYMENT"
    && verifiedStatuses.has(transaction.status)
    && transaction.amount > 0
  ));
  if (anyVerifiedTx && expected > 0 && anyVerifiedTx.amount !== expected) {
    report.amountMismatch.push({
      reference: booking.reference,
      id: booking.id,
      expectedAmount: expected,
      transactionAmount: anyVerifiedTx.amount,
      transactionStatus: anyVerifiedTx.status,
    });
  }

  if (String(booking.paydunyaStatus || "").toUpperCase() === "COMPLETED" && !booking.paydunyaVerifiedAt) {
    report.completedWithoutVerifiedAt.push({
      reference: booking.reference,
      id: booking.id,
    });
  }

  if (verifiedStatuses.has(booking.paymentStatus) && !hasPayDunyaProof(booking)) {
    report.verifiedStatusWithoutPayDunyaProof.push({
      reference: booking.reference,
      id: booking.id,
      paymentStatus: booking.paymentStatus,
      paydunyaStatus: booking.paydunyaStatus,
      paydunyaVerifiedAt: booking.paydunyaVerifiedAt,
    });
  }

  if (operationalPaidStatuses.has(booking.status) && !booking.isQuoteOnly && (!verifiedTx || !hasPayDunyaProof(booking))) {
    report.operationalStatusWithoutVerifiedFunds.push({
      reference: booking.reference,
      id: booking.id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paydunyaStatus: booking.paydunyaStatus,
      paydunyaVerifiedAt: booking.paydunyaVerifiedAt,
    });
  }
}

console.log(JSON.stringify(report, null, 2));

const anomalyCount = Object.entries(report)
  .filter(([key]) => key !== "totalBookings")
  .reduce((sum, [, value]) => sum + value.length, 0);

await prisma.$disconnect();
process.exitCode = anomalyCount > 0 ? 1 : 0;
