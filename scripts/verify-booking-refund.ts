import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildBookingRefundLedgerReference,
  calculateRemainingBookingRefund,
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

const route = readFileSync("src/app/api/admin/bookings/[id]/route.ts", "utf8");
assert.match(route, /action === "refund" \? "FINANCE_MANAGE" : "BOOKINGS_MANAGE"/);
assert.match(route, /clientRefundRequests:\s*\{[\s\S]*?status:\s*\{ in: \["PENDING", "APPROVED"\] \}[\s\S]*?take: 1/);
assert.doesNotMatch(route, /clientRefundRequests\.find[\s\S]*?\?\? booking\.clientRefundRequests\[0\]/);
assert.match(route, /processedAt: null[\s\S]*?claimed\.count !== 1/);
assert.match(route, /buildBookingRefundLedgerReference\(refundRequest\.id\)/);
assert.match(route, /!transaction\.refundedRescheduleRequest/);
assert.match(route, /\{ isolationLevel: "Serializable" \}/);
assert.match(route, /e\?\.code === "P2002" \|\| e\?\.code === "P2034"/);

console.log("✓ remboursement général: plafond restant, idempotence, concurrence et permission vérifiés");
