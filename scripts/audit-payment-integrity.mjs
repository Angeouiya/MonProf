import fs from "node:fs";
import { createJiti } from "jiti";
import { PrismaClient } from "@prisma/client";

const jiti = createJiti(import.meta.url);
const {
  getExpectedClientPaymentAmount,
  getVerifiedPayDunyaClientPaymentTransaction,
  hasCompletedPayDunyaProof,
  hasVerifiedClientFunds,
  hasVerifiedPayDunyaClientPayment,
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
  const expected = getExpectedClientPaymentAmount(booking);
  const verifiedTx = getVerifiedPayDunyaClientPaymentTransaction(booking);

  if (hasVerifiedClientFunds(booking.paymentStatus) && !verifiedTx) {
    report.paidWithoutVerifiedTransaction.push({
      reference: booking.reference,
      id: booking.id,
      paymentStatus: booking.paymentStatus,
      expectedAmount: expected,
    });
  }

  const anyVerifiedTx = booking.transactions.find((transaction) => (
    transaction.type === "CLIENT_PAYMENT"
    && hasVerifiedClientFunds(transaction.status)
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

  if (hasVerifiedClientFunds(booking.paymentStatus) && !hasCompletedPayDunyaProof(booking)) {
    report.verifiedStatusWithoutPayDunyaProof.push({
      reference: booking.reference,
      id: booking.id,
      paymentStatus: booking.paymentStatus,
      paydunyaStatus: booking.paydunyaStatus,
      paydunyaVerifiedAt: booking.paydunyaVerifiedAt,
    });
  }

  if (isOperationalBookingStatus(booking.status) && !booking.isQuoteOnly && !hasVerifiedPayDunyaClientPayment(booking)) {
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
