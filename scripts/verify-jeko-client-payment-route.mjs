import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  isJekoBookingPayable,
  parseJekoCheckoutBody,
  planJekoBookingAttempt,
  platformMethodToJeko,
} = jiti("../src/lib/jeko-client-payment.ts");

assert.deepEqual(parseJekoCheckoutBody({ paymentMethod: "WAVE" }), {
  ok: true,
  paymentMethod: "wave",
});
assert.equal(parseJekoCheckoutBody({ paymentMethod: "card" }).ok, false);
assert.equal(parseJekoCheckoutBody({ paymentMethod: "wave", amount: 1 }).ok, false);
assert.equal(parseJekoCheckoutBody(null).ok, false);

const payableBooking = {
  status: "PENDING_PAYMENT",
  paymentStatus: "FAILED",
  isQuoteOnly: false,
  totalClientPays: 20_000,
  totalPrice: 20_000,
};
assert.equal(isJekoBookingPayable(payableBooking), true);
assert.equal(isJekoBookingPayable({ ...payableBooking, paymentStatus: "BLOCKED" }), false);
assert.equal(isJekoBookingPayable({ ...payableBooking, status: "CANCELLED" }), false);
assert.equal(isJekoBookingPayable({ ...payableBooking, isQuoteOnly: true }), false);
assert.equal(isJekoBookingPayable({ ...payableBooking, totalClientPays: 0, totalPrice: 0 }), false);

const firstWave = planJekoBookingAttempt({
  bookingId: "booking_123",
  requestedMethod: "wave",
  attempts: [],
});
assert.deepEqual(firstWave, {
  kind: "create",
  attemptId: null,
  idempotencyKey: "BOOKING:booking_123:JEKO:ATTEMPT:1",
  paymentMethod: "wave",
});

// Deux POST concurrents, même avec des moyens différents, calculent la même
// clé. La contrainte unique laisse une seule tentative gagner.
const firstOrange = planJekoBookingAttempt({
  bookingId: "booking_123",
  requestedMethod: "orange",
  attempts: [],
});
assert.equal(firstOrange.idempotencyKey, firstWave.idempotencyKey);

const reuse = planJekoBookingAttempt({
  bookingId: "booking_123",
  requestedMethod: "orange",
  attempts: [{
    id: "attempt_pending",
    idempotencyKey: "BOOKING:legacy:wave",
    status: "PENDING",
    method: "WAVE",
  }],
});
assert.deepEqual(reuse, {
  kind: "reuse",
  attemptId: "attempt_pending",
  idempotencyKey: "BOOKING:legacy:wave",
  paymentMethod: "wave",
});

const retry = planJekoBookingAttempt({
  bookingId: "booking_123",
  requestedMethod: "mtn",
  attempts: [
    { id: "failed_2", idempotencyKey: "failed:2", status: "REJECTED", method: "ORANGE_MONEY" },
    { id: "failed_1", idempotencyKey: "failed:1", status: "FAILED", method: "WAVE" },
  ],
});
assert.deepEqual(retry, {
  kind: "create",
  attemptId: null,
  idempotencyKey: "BOOKING:booking_123:JEKO:ATTEMPT:3",
  paymentMethod: "mtn",
});

const paid = planJekoBookingAttempt({
  bookingId: "booking_123",
  requestedMethod: "wave",
  attempts: [
    { id: "pending", idempotencyKey: "pending", status: "PENDING", method: "WAVE" },
    { id: "paid", idempotencyKey: "paid", status: "SUCCEEDED", method: "WAVE" },
  ],
});
assert.deepEqual(paid, { kind: "already_paid", attemptId: "paid" });

const blocked = planJekoBookingAttempt({
  bookingId: "booking_123",
  requestedMethod: "wave",
  attempts: [{ id: "bad", idempotencyKey: "bad", status: "REQUESTING", method: "CARD" }],
});
assert.equal(blocked.kind, "blocked");

assert.equal(platformMethodToJeko("DJAMO"), "djamo");
assert.equal(platformMethodToJeko("CARD"), null);

const provider = readFileSync(new URL("../src/lib/payment-provider.ts", import.meta.url), "utf8");
assert.match(provider, /error\.httpStatus === 409/);
assert.match(provider, /recoverJekoPaymentAttemptIdentity\(attempt\.id/g);
assert.match(provider, /if \(attempt\.status === "REQUESTING"\)/g);
assert.doesNotMatch(
  provider,
  /\{ status: "REQUESTING", requestedAt: \{ lt: staleBefore \} \}/,
  "une REQUESTING ambiguë ne doit jamais redevenir éligible à un POST aveugle",
);
assert.match(provider, /where:\s*\{ id: attempt\.id, status:\s*\{ not:\s*"SUCCEEDED" \} \}/g);
assert.match(provider, /booking\.paymentProvider === "PAYDUNYA"/);
assert.match(provider, /booking\.paydunyaToken \|\| booking\.paydunyaCheckoutUrl/);
assert.match(provider, /const providerClaim = await db\.booking\.updateMany/);
assert.match(provider, /\{ paymentProvider: null \}[\s\S]*?\{ paymentProvider: "JEKO" \}/);
assert.match(provider, /Aucun lien Jèko concurrent/);

const bookingRoute = readFileSync(
  new URL("../src/app/api/bookings/[id]/route.ts", import.meta.url),
  "utf8",
);
assert.match(bookingRoute, /booking\.paymentProvider === "JEKO" \|\| booking\.paymentAttempts\.length > 0/);
assert.match(bookingRoute, /code:\s*"PAYMENT_PROVIDER_LOCKED"/);
assert.match(bookingRoute, /code:\s*"PAYDUNYA_NEW_CHECKOUT_DISABLED"/g);
assert.doesNotMatch(bookingRoute, /createPayDunyaCheckoutInvoice/);
assert.doesNotMatch(bookingRoute, /createPayDunyaRescheduleFeeInvoice/);
assert.match(bookingRoute, /teacherAdminMessages:\s*true,[\s\S]*?paymentAttempts:\s*true/);

console.log("Jèko client payment route verification passed: strict body, provider lock, ambiguous retries and idempotence.");
