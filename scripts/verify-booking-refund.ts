import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildBookingRefundLedgerReference,
  calculateRemainingBookingRefund,
  evaluateBookingRefundPayoutSafety,
  normalizeBookingRefundExternalReference,
} from "../src/lib/booking-refund";

const fullRefund = calculateRemainingBookingRefund({
  confirmedClientPaymentAmount: 20_600,
  finalizedRefundAmount: 0,
  cancellationRefundAmount: 20_000,
  totalClientPays: 20_600,
  totalPrice: 20_000,
  paymentServiceFeeAmount: 600,
  requestAmount: 20_000,
});
assert.equal(fullRefund.refundAmount, 20_000);
assert.equal(fullRefund.finalPaymentStatus, "REFUNDED");

const remainingRefund = calculateRemainingBookingRefund({
  confirmedClientPaymentAmount: 20_600,
  finalizedRefundAmount: 8_000,
  cancellationRefundAmount: 20_000,
  totalClientPays: 20_600,
  totalPrice: 20_000,
  paymentServiceFeeAmount: 600,
  requestAmount: 20_000,
});
assert.equal(remainingRefund.refundAmount, 12_000, "seul le solde restant doit être remboursé");
assert.equal(remainingRefund.finalPaymentStatus, "REFUNDED");

const policyCap = calculateRemainingBookingRefund({
  confirmedClientPaymentAmount: 20_600,
  finalizedRefundAmount: 4_000,
  cancellationRefundAmount: 10_000,
  totalClientPays: 20_600,
  totalPrice: 20_000,
  paymentServiceFeeAmount: 600,
  requestAmount: 20_000,
});
assert.equal(policyCap.refundAmount, 6_000, "la décision d'annulation plafonne le remboursement cumulé");
assert.equal(policyCap.finalPaymentStatus, "PARTIALLY_REFUNDED");

const requestCap = calculateRemainingBookingRefund({
  confirmedClientPaymentAmount: 20_600,
  finalizedRefundAmount: 0,
  cancellationRefundAmount: 20_000,
  totalClientPays: 20_600,
  totalPrice: 20_000,
  paymentServiceFeeAmount: 600,
  requestAmount: 7_500,
});
assert.equal(requestCap.refundAmount, 7_500, "le ledger ne doit pas dépasser la demande revendiquée");

assert.equal(
  buildBookingRefundLedgerReference(" cm/refund:123 "),
  "TX-REFUND-BOOKING-cm-refund-123",
  "la référence idempotente doit être stable par demande",
);
assert.equal(
  normalizeBookingRefundExternalReference("  abc - 123 / ci  "),
  "ABC-123/CI",
  "une même preuve opérateur doit produire une référence canonique",
);

assert.deepEqual(
  evaluateBookingRefundPayoutSafety({
    activePayoutReferences: ["TP-JEKO-IN-FLIGHT"],
    sessions: [{ status: "RELEASED", paidAmount: 0 }],
  }),
  {
    safe: false,
    code: "TEACHER_PAYOUT_IN_PROGRESS",
    message: "Un versement professeur est encore en cours (TP-JEKO-IN-FLIGHT). Rapprochez ou annulez ce transfert avant le remboursement client.",
  },
  "un DRAFT Jèko doit bloquer le remboursement",
);
assert.equal(
  evaluateBookingRefundPayoutSafety({
    sessions: [{ status: "PARTIALLY_PAID", paidAmount: 2_000 }],
  }).safe,
  false,
  "une séance déjà versée ne doit jamais être effacée par un remboursement",
);
assert.deepEqual(
  evaluateBookingRefundPayoutSafety({
    sessions: [{ status: "RELEASED", paidAmount: 0 }],
  }),
  { safe: true, allowedCancellationPenaltyPaid: 0 },
);

const route = readFileSync("src/app/api/admin/bookings/[id]/route.ts", "utf8");
const finalization = readFileSync("src/lib/booking-refund-finalization.ts", "utf8");
const disputeRoute = readFileSync("src/app/api/admin/disputes/[id]/route.ts", "utf8");
const sessionRoute = readFileSync("src/app/api/bookings/[id]/sessions/[sessionId]/route.ts", "utf8");
const payoutRoute = readFileSync("src/app/api/admin/teacher-payouts/route.ts", "utf8");
const bookingSessions = readFileSync("src/lib/booking-sessions.ts", "utf8");
assert.match(route, /action === "refund" \? "FINANCE_MANAGE" : "BOOKINGS_MANAGE"/);
assert.match(route, /finalizeBookingRefundInTransaction\(tx/);
assert.match(route, /\{ isolationLevel: "Serializable" \}/);
assert.match(route, /e\?\.code === "P2002" \|\| e\?\.code === "P2034"/);
assert.match(finalization, /clientRefundRequests:\s*\{[\s\S]*?status:\s*\{ in: \["PENDING", "APPROVED"\] \}[\s\S]*?take: 1/);
assert.match(finalization, /processedAt: null[\s\S]*?claimed\.count !== 1/);
assert.match(finalization, /buildBookingRefundLedgerReference\(refundRequest\.id\)/);
assert.match(finalization, /!transaction\.refundedRescheduleRequest/);
assert.match(finalization, /lockTeacherPayoutBalance/);
assert.match(finalization, /BOOKING_TEACHER_LOCK_SET_CHANGED/);
assert.match(finalization, /BOOKING_REFUND_NOT_AUTHORIZED/);
assert.match(finalization, /snapshot\.cancellationRefundAmount <= 0/);
assert.match(finalization, /pg_advisory_xact_lock/);
assert.match(finalization, /data: \{ status: "REFUNDED" \}/);
assert.match(finalization, /status: \{ in: \["OPEN", "INVESTIGATING", "RESOLVED"\] \}/);
assert.match(disputeRoute, /paymentStatus: "REFUND_PENDING"/);
assert.match(disputeRoute, /status: "RESOLVED"/);
assert.match(disputeRoute, /SESSION_DISPUTE_FULL_REFUND_BLOCKED/);
assert.match(disputeRoute, /DISPUTE_OPENED[\s\S]*?fromStatus/);
assert.match(disputeRoute, /settleSessionDispute/);
assert.doesNotMatch(disputeRoute, /type: "REFUND"/);
assert.match(sessionRoute, /DISPUTE_OPENED_AFTER_PAYOUT/);
assert.match(sessionRoute, /DISPUTE_ALREADY_OPEN/);
assert.match(sessionRoute, /requiresManualFinancialReview/);
assert.match(sessionRoute, /lockAndRevalidateSession/);
assert.match(payoutRoute, /current\.disputes\.length > 0/);
assert.match(bookingSessions, /booking\.status === "DISPUTED"/);

console.log("✓ remboursement général: calculs purs et gardes statiques d'idempotence, concurrence et permission vérifiés");
