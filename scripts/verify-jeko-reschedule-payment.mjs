import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  isJekoReschedulePayable,
  parseJekoCheckoutBody,
  planJekoRescheduleAttempt,
  resolveJekoPaymentStatusConsensus,
  validateJekoRescheduleFinancialSnapshot,
} = jiti("../src/lib/jeko-client-payment.ts");

const payable = { status: "PAYMENT_PENDING", totalToPay: 12_360, paidAt: null };
assert.equal(isJekoReschedulePayable(payable), true);
assert.equal(isJekoReschedulePayable({ ...payable, status: "PAYMENT_FAILED" }), true);
assert.equal(isJekoReschedulePayable({ ...payable, status: "AWAITING_TEACHER" }), false);
assert.equal(isJekoReschedulePayable({ ...payable, totalToPay: 0 }), false);
assert.equal(isJekoReschedulePayable({ ...payable, paidAt: new Date() }), false);

const validFinancialSnapshot = {
  feeAmount: 12_000,
  feeTeacherAmount: 8_400,
  feePlatformAmount: 3_600,
  paymentServiceFeeAmount: 360,
  totalToPay: 12_360,
};
assert.equal(validateJekoRescheduleFinancialSnapshot(validFinancialSnapshot), null);
assert.match(
  validateJekoRescheduleFinancialSnapshot({ ...validFinancialSnapshot, feeTeacherAmount: 8_401 }),
  /commission/,
);
assert.match(
  validateJekoRescheduleFinancialSnapshot({ ...validFinancialSnapshot, totalToPay: 12_359 }),
  /total client/,
);
assert.match(
  validateJekoRescheduleFinancialSnapshot({ ...validFinancialSnapshot, feeAmount: -1 }),
  /montant invalide/,
);
assert.equal(resolveJekoPaymentStatusConsensus(["success", "success", "success"]), "success");
assert.equal(resolveJekoPaymentStatusConsensus(["error", "error", "error"]), "error");
assert.equal(resolveJekoPaymentStatusConsensus(["success", "error", "success"]), "pending");
assert.equal(resolveJekoPaymentStatusConsensus(["success", "pending", "success"]), "pending");

assert.equal(parseJekoCheckoutBody({ paymentMethod: "wave", amount: 1 }).ok, false);

const first = planJekoRescheduleAttempt({
  rescheduleRequestId: "reschedule_123",
  requestedMethod: "wave",
  attempts: [],
});
assert.deepEqual(first, {
  kind: "create",
  attemptId: null,
  idempotencyKey: "RESCHEDULE:reschedule_123:JEKO:ATTEMPT:1",
  paymentMethod: "wave",
});
const concurrent = planJekoRescheduleAttempt({
  rescheduleRequestId: "reschedule_123",
  requestedMethod: "orange",
  attempts: [],
});
assert.equal(concurrent.idempotencyKey, first.idempotencyKey);

const reused = planJekoRescheduleAttempt({
  rescheduleRequestId: "reschedule_123",
  requestedMethod: "mtn",
  attempts: [{
    id: "attempt_pending",
    idempotencyKey: first.idempotencyKey,
    status: "PENDING",
    method: "WAVE",
  }],
});
assert.deepEqual(reused, {
  kind: "reuse",
  attemptId: "attempt_pending",
  idempotencyKey: first.idempotencyKey,
  paymentMethod: "wave",
});

const retry = planJekoRescheduleAttempt({
  rescheduleRequestId: "reschedule_123",
  requestedMethod: "djamo",
  attempts: [
    { id: "failed_2", idempotencyKey: "old:2", status: "REJECTED", method: "ORANGE_MONEY" },
    { id: "failed_1", idempotencyKey: "old:1", status: "FAILED", method: "WAVE" },
  ],
});
assert.equal(retry.idempotencyKey, "RESCHEDULE:reschedule_123:JEKO:ATTEMPT:3");

const paid = planJekoRescheduleAttempt({
  rescheduleRequestId: "reschedule_123",
  requestedMethod: "wave",
  attempts: [
    { id: "pending", idempotencyKey: "pending", status: "PENDING", method: "WAVE" },
    { id: "paid", idempotencyKey: "paid", status: "SUCCEEDED", method: "WAVE" },
  ],
});
assert.deepEqual(paid, { kind: "already_paid", attemptId: "paid" });

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
assert.match(schema, /rescheduleRequestId\s+String\?/);
assert.match(schema, /paymentAttempts\s+PaymentAttempt\[\]/);
assert.match(schema, /paymentProvider\s+PaymentProvider\?/);

const provider = readFileSync(new URL("../src/lib/payment-provider.ts", import.meta.url), "utf8");
assert.match(provider, /const amountXof = request\.totalToPay/);
assert.match(provider, /purpose: "RESCHEDULE_FEE" as const/);
assert.match(provider, /request\.paymentProvider !== "JEKO"/);

const reconciliation = readFileSync(new URL("../src/lib/jeko-reschedule-reconciliation.ts", import.meta.url), "utf8");
assert.match(reconciliation, /attempt\.amountXof !== request\.totalToPay/);
assert.match(reconciliation, /attempt\.teacherAmountXof !== request\.feeTeacherAmount/);
assert.match(reconciliation, /"CANCELLED", "EXPIRED"/);
assert.match(reconciliation, /attempt\.status === "REJECTED"/);
assert.match(reconciliation, /notIn: \["SUCCEEDED", "REJECTED"\]/);
assert.match(reconciliation, /type: "RESCHEDULE_FEE"/);
assert.match(reconciliation, /status: "AWAITING_TEACHER"/);
assert.match(reconciliation, /createRescheduleAwaitingTeacherNotifications/);

const bookingApi = readFileSync(new URL("../src/app/api/bookings/[id]/route.ts", import.meta.url), "utf8");
assert.match(bookingApi, /paymentProvider: policy\.feeAmount > 0 \? "JEKO" : null/);
assert.match(bookingApi, /request\.paymentProvider === "JEKO"/);
assert.match(bookingApi, /request\.paymentProvider !== "JEKO"/);
assert.match(bookingApi, /createJekoRescheduleCheckout/);
assert.match(bookingApi, /reconcilePayDunyaReschedulePayment/);
assert.match(bookingApi, /reconcileJekoReschedulePaymentAttempt/);

const dedicatedRoute = readFileSync(
  new URL("../src/app/api/bookings/[id]/reschedule-requests/[requestId]/jeko-payment/route.ts", import.meta.url),
  "utf8",
);
assert.match(dedicatedRoute, /where: \{ id: safeRequestId, bookingId: safeBookingId, clientId \}/);
assert.match(dedicatedRoute, /code: "LEGACY_PAYDUNYA_RESCHEDULE"/);
assert.match(dedicatedRoute, /purpose: "RESCHEDULE_FEE"/);
assert.match(dedicatedRoute, /paymentProvider === "JEKO"/);

const webhookReconciliation = readFileSync(new URL("../src/lib/jeko-reconciliation.ts", import.meta.url), "utf8");
assert.match(webhookReconciliation, /attempt\.purpose === "RESCHEDULE_FEE"/);
assert.match(webhookReconciliation, /reconcileJekoRescheduleWebhook/);

const webhookRoute = readFileSync(new URL("../src/app/api/webhooks/jeko/route.ts", import.meta.url), "utf8");
assert.match(webhookRoute, /verifyJekoWebhookSignature\(rawBody/);
assert.match(webhookRoute, /readRawBodyWithLimit\(request, MAX_WEBHOOK_BYTES\)/);

console.log("Jèko reschedule verification passed: strict server amount, idempotent retries, legacy PayDunya preservation and server-only settlement.");
