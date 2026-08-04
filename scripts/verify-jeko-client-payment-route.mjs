import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  isJekoBookingPayable,
  isStaleUnidentifiedJekoRequest,
  parseJekoCheckoutBody,
  planJekoBookingAttempt,
  planJekoRescheduleAttempt,
  platformMethodToJeko,
} = jiti("../src/lib/jeko-client-payment.ts");

const recoveryNow = new Date("2026-07-31T20:00:00.000Z");
assert.equal(isStaleUnidentifiedJekoRequest({
  status: "REQUESTING",
  providerOrderId: null,
  checkoutUrl: null,
  requestedAt: "2026-07-31T19:29:59.999Z",
  createdAt: "2026-07-31T19:20:00.000Z",
  now: recoveryNow,
}), true);
assert.equal(isStaleUnidentifiedJekoRequest({
  status: "REQUESTING",
  providerOrderId: null,
  checkoutUrl: null,
  requestedAt: "2026-07-31T19:45:00.000Z",
  createdAt: "2026-07-31T19:20:00.000Z",
  now: recoveryNow,
}), false);
assert.equal(isStaleUnidentifiedJekoRequest({
  status: "REQUESTING",
  providerOrderId: "jeko_request_known",
  checkoutUrl: null,
  requestedAt: "2026-07-31T18:00:00.000Z",
  createdAt: "2026-07-31T18:00:00.000Z",
  now: recoveryNow,
}), false);

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

const failedWithProviderIdentity = planJekoBookingAttempt({
  bookingId: "booking_123",
  requestedMethod: "mtn",
  attempts: [{
    id: "failed_remote",
    idempotencyKey: "BOOKING:booking_123:JEKO:ATTEMPT:1",
    status: "FAILED",
    method: "WAVE",
    providerOrderId: "jeko_request_123",
    failureCode: "P2024",
  }],
});
assert.deepEqual(failedWithProviderIdentity, {
  kind: "reuse",
  attemptId: "failed_remote",
  idempotencyKey: "BOOKING:booking_123:JEKO:ATTEMPT:1",
  paymentMethod: "wave",
});
assert.equal(planJekoRescheduleAttempt({
  rescheduleRequestId: "reschedule_123",
  requestedMethod: "orange",
  attempts: [{
    id: "failed_reschedule_remote",
    idempotencyKey: "RESCHEDULE:reschedule_123:JEKO:ATTEMPT:1",
    status: "FAILED",
    method: "MTN_MONEY",
    providerOrderId: "jeko_reschedule_123",
  }],
}).kind, "reuse");

const confirmedProviderFailure = planJekoBookingAttempt({
  bookingId: "booking_123",
  requestedMethod: "orange",
  attempts: [{
    id: "failed_confirmed",
    idempotencyKey: "BOOKING:booking_123:JEKO:ATTEMPT:1",
    status: "FAILED",
    method: "WAVE",
    providerOrderId: "jeko_failed_123",
    failureCode: "JEKO_PAYMENT_FAILED",
  }],
});
assert.deepEqual(confirmedProviderFailure, {
  kind: "create",
  attemptId: null,
  idempotencyKey: "BOOKING:booking_123:JEKO:ATTEMPT:2",
  paymentMethod: "orange",
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
const recoverySource = readFileSync(
  new URL("../src/lib/jeko-payment-request-recovery.ts", import.meta.url),
  "utf8",
);
const jekoCheckoutRoute = readFileSync(
  new URL("../src/app/api/bookings/[id]/jeko-payment/route.ts", import.meta.url),
  "utf8",
);
assert.match(recoverySource, /status: "EXPIRED"[\s\S]*?failureCode: RECOVERY_EXPIRED_CODE/);
assert.match(recoverySource, /\{ failureCode: null \}[\s\S]*?failureCode: \{ not: RECOVERY_PENDING_CODE \}/);
assert.match(recoverySource, /isStaleUnidentifiedJekoRequest\(attempt\)/);
assert.match(jekoCheckoutRoute, /JEKO_STALE_ATTEMPT_EXPIRED/);
assert.match(jekoCheckoutRoute, /status: "processing"[\s\S]*?checkoutUrl: null[\s\S]*?message: recovery\.message/);
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
assert.match(provider, /const providerClaim = await tx\.booking\.updateMany/);
assert.match(provider, /FROM "Booking"[\s\S]*?FOR UPDATE/);
assert.match(provider, /booking\.status !== "PENDING_PAYMENT"[\s\S]*?booking\.paymentStatus !== "FAILED"[\s\S]*?booking\.isQuoteOnly/);
assert.match(provider, /expectedAmountXof[\s\S]*?expectedPricingSnapshot/);
assert.match(provider, /\{ paymentProvider: null \}[\s\S]*?\{ paymentProvider: "JEKO" \}/);
assert.match(provider, /Aucun lien Jèko concurrent/);
assert.equal(
  provider.match(/let paymentRequest: Awaited<ReturnType<typeof createJekoPaymentRequest>>/g)?.length,
  2,
);
assert.equal(
  provider.match(/preserveJekoProviderIdentityAfterLocalFailure\(attempt\.id, paymentRequest, error\)/g)?.length,
  2,
);
assert.match(provider, /status: "PENDING",[\s\S]*?failureCode: "JEKO_LOCAL_PERSISTENCE_PENDING"/);
assert.equal(
  provider.match(/attempt\.status === "FAILED" && attempt\.providerOrderId/g)?.length,
  2,
);
assert.equal(
  provider.match(/attempt\.failureCode === "JEKO_PAYMENT_FAILED"/g)?.length,
  2,
);
assert.match(provider, /FROM "BookingRescheduleRequest"[\s\S]*?FOR UPDATE/);
assert.match(provider, /currentBooking\.status[\s\S]*?"PAID"[\s\S]*?"PENDING_ADMIN_VALIDATION"[\s\S]*?"CONFIRMED"[\s\S]*?"ASSIGNED"/);
assert.match(
  provider,
  /status: "FAILED",[\s\S]{0,180}?providerOrderId: \{ not: null \},[\s\S]{0,220}?failureCode: \{ not: "JEKO_PAYMENT_FAILED" \}/,
);

const bookingRoute = readFileSync(
  new URL("../src/app/api/bookings/[id]/route.ts", import.meta.url),
  "utf8",
);
assert.match(bookingRoute, /booking\.paymentProvider === "JEKO" \|\| booking\.paymentAttempts\.length > 0/);
assert.match(bookingRoute, /code:\s*"PAYMENT_PROVIDER_LOCKED"/);
assert.match(bookingRoute, /code:\s*"PAYDUNYA_NEW_CHECKOUT_DISABLED"/g);
assert.doesNotMatch(bookingRoute, /createPayDunyaCheckoutInvoice/);
assert.doesNotMatch(bookingRoute, /createPayDunyaRescheduleFeeInvoice/);
assert.match(
  bookingRoute,
  /case "delete_draft":[\s\S]*?FROM "Booking"[\s\S]*?FOR UPDATE[\s\S]*?paymentVerifiedAt:\s*true[\s\S]*?paydunyaVerifiedAt:\s*true/,
);
assert.match(
  bookingRoute,
  /case "delete_draft":[\s\S]*?tx\.booking\.update\([\s\S]*?status:\s*"CANCELLED"[\s\S]*?cancellationReason:\s*CLIENT_DELETED_DRAFT_REASON/,
);
const deleteDraftSection = bookingRoute.slice(
  bookingRoute.indexOf('case "delete_draft"'),
  bookingRoute.indexOf('case "paydunya_checkout"'),
);
assert.doesNotMatch(deleteDraftSection, /tx\.booking\.delete|paymentAttempts:\s*true|lien de paiement actif/i);
assert.match(bookingRoute, /case "cancel":[\s\S]*?FROM "Booking"[\s\S]*?FOR UPDATE/);
assert.match(bookingRoute, /!cancellableStatuses\.includes\(currentBooking\.status\)/);
assert.match(bookingRoute, /status: "FAILED", providerOrderId: \{ not: null \}/);

const bookingForm = readFileSync(
  new URL("../src/app/client/reserver/reserver-form.tsx", import.meta.url),
  "utf8",
);
const bookingActions = readFileSync(
  new URL("../src/app/client/reservations/[id]/actions.tsx", import.meta.url),
  "utf8",
);
const reschedulePanel = readFileSync(
  new URL("../src/app/client/reservations/[id]/reschedule-request-panel.tsx", import.meta.url),
  "utf8",
);
for (const clientSource of [bookingForm, bookingActions, reschedulePanel]) {
  assert.match(clientSource, /isAllowedJekoRedirectUrl/);
}
assert.match(bookingForm, /isAllowedJekoRedirectUrl\(data\.payment\?\.checkoutUrl\)/);
assert.match(bookingForm, /Le dossier reste en brouillon et aucun professeur n'est notifié/);

console.log("Jèko client payment route verification passed: strict body, provider lock, ambiguous retries and idempotence.");
