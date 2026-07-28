import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  buildRescheduleRefundLedgerReference,
  normalizeRescheduleRefundExternalReference,
  validateRescheduleRefundSnapshot,
} = jiti("../src/lib/reschedule-refund.ts");

const paidAt = new Date("2026-07-28T12:00:00.000Z");
const validSnapshot = {
  status: "REFUND_REQUIRED",
  paidAt,
  feeAmount: 10_000,
  totalToPay: 10_300,
  transaction: {
    type: "RESCHEDULE_FEE",
    status: "REFUND_PENDING",
    amount: 10_300,
    paidAt,
  },
};

assert.equal(validateRescheduleRefundSnapshot(validSnapshot), null);
assert.match(validateRescheduleRefundSnapshot({ ...validSnapshot, status: "AWAITING_TEACHER" }), /pas en attente/);
assert.match(validateRescheduleRefundSnapshot({ ...validSnapshot, paidAt: null }), /Aucun supplément payé/);
assert.match(validateRescheduleRefundSnapshot({ ...validSnapshot, totalToPay: 10_301 }), /ne correspond pas exactement/);
assert.match(validateRescheduleRefundSnapshot({
  ...validSnapshot,
  transaction: { ...validSnapshot.transaction, amount: 10_301 },
}), /ne correspond pas exactement/);
assert.match(validateRescheduleRefundSnapshot({
  ...validSnapshot,
  transaction: { ...validSnapshot.transaction, status: "BLOCKED" },
}), /pas en attente/);
assert.match(validateRescheduleRefundSnapshot({ ...validSnapshot, transaction: null }), /introuvable/);

assert.equal(normalizeRescheduleRefundExternalReference("  JEKO\nTX-9344  "), "JEKO TX-9344");
assert.equal(normalizeRescheduleRefundExternalReference("x"), null);
assert.equal(normalizeRescheduleRefundExternalReference("x".repeat(161)), null);
assert.equal(
  buildRescheduleRefundLedgerReference("cm-reschedule_123"),
  "TX-REFUND-RS-cm-reschedule_123",
);
assert.throws(() => buildRescheduleRefundLedgerReference("../invalide"), /invalide/);

const api = readFileSync("src/app/api/admin/reschedule-requests/[id]/refund/route.ts", "utf8");
const adminPage = readFileSync("src/app/admin/reservations/[id]/page.tsx", "utf8");
const button = readFileSync("src/app/admin/reservations/[id]/reschedule-refund-button.tsx", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260728080000_reschedule_refund_tracking/migration.sql",
  "utf8",
);

assert.match(api, /requireAdminApi\("FINANCE_MANAGE"\)/);
assert.match(api, /validateRescheduleRefundSnapshot\(request\)/);
assert.match(api, /const refundAmount = sourceTransaction\.amount/);
assert.doesNotMatch(api, /body\.amount/);
assert.match(api, /status: "REFUND_REQUIRED"[\s\S]*status: "REFUNDED"/);
assert.match(api, /type: "RESCHEDULE_FEE"[\s\S]*status: "REFUND_PENDING"[\s\S]*amount: refundAmount/);
assert.match(api, /type: "REFUND"[\s\S]*status: "REFUNDED"/);
assert.match(api, /refundTransactionId: refundTransaction\.id/);
assert.match(api, /tx\.adminActionLog\.create/);
assert.match(api, /tx\.clientCommunication\.create/);
assert.match(button, /JSON\.stringify\(\{ externalReference: trimmedReference \}\)/);
assert.doesNotMatch(button, /JSON\.stringify\(\{[^}]*amount/);
assert.match(adminPage, /request\.status === "REFUND_REQUIRED"[\s\S]*RescheduleRefundButton/);
assert.match(adminPage, /request\.status === "REFUNDED"[\s\S]*request\.refundedAmount/);
assert.match(migration, /ADD VALUE 'REFUNDED'/);
assert.match(migration, /refundTransactionId/);
assert.match(migration, /refundExternalReference_key/);
assert.match(migration, /FOREIGN KEY/);

console.log("OK reschedule supplement refund workflow verified");
