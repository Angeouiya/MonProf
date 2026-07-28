import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  assertJekoCallbackUrl,
  calculateJekoWebhookSignature,
  isAllowedJekoRedirectUrl,
  isJekoIncomingPaymentType,
  jekoAmountCentsToXof,
  jekoFeeCentsToCoveredXof,
  parseJekoWebhookPayload,
  verifyJekoWebhookSignature,
  xofToJekoAmountCents,
} = jiti("../src/lib/jeko-utils.ts");

assert.equal(xofToJekoAmountCents(1), 100);
assert.equal(xofToJekoAmountCents(10_000), 1_000_000);
assert.equal(jekoAmountCentsToXof(1_000_000), 10_000);
assert.equal(jekoFeeCentsToCoveredXof(15_000), 150);
assert.equal(jekoFeeCentsToCoveredXof(151), 2, "les frais techniques sont couverts sans sous-estimation");
assert.throws(() => xofToJekoAmountCents(0));
assert.throws(() => xofToJekoAmountCents(1.5));
assert.throws(() => xofToJekoAmountCents(21_474_837));
assert.throws(() => jekoAmountCentsToXof(101), /nombre entier de FCFA/);

assert.equal(
  isAllowedJekoRedirectUrl("https://pay.jeko.africa/payment/d22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc"),
  true,
);
assert.equal(isAllowedJekoRedirectUrl("http://pay.jeko.africa/payment/abc"), false);
assert.equal(isAllowedJekoRedirectUrl("https://pay.jeko.africa.evil.example/payment/abc"), false);
assert.equal(isAllowedJekoRedirectUrl("https://evil.example/?next=https://pay.jeko.africa/payment/abc"), false);
assert.equal(assertJekoCallbackUrl("https://www.competence.ci/paiement/retour", "successUrl").startsWith("https://"), true);
assert.throws(() => assertJekoCallbackUrl("http://localhost:3000/retour", "errorUrl"));
assert.throws(() => assertJekoCallbackUrl(
  "https://attacker.example/retour",
  "successUrl",
  "https://www.competence.ci",
));

const directPayload = JSON.stringify({
  id: "txn_test_001",
  amount: { amount: 1_000_000, currency: "XOF" },
  fees: { amount: 15_000, currency: "XOF" },
  status: "success",
  counterpartLabel: "Client Test",
  counterpartIdentifier: "+2250700000000",
  paymentMethod: "wave",
  transactionType: "PaymentRequest",
  businessName: "Compétence",
  storeName: "Compétence Test",
  description: "Réservation MP-TEST",
  executedAt: "2026-07-27T10:00:00.000Z",
  transactionDetails: {
    id: "d22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc",
    reference: "JEKO-MP-TEST-ABCDEF",
  },
});
const secret = "test-secret-that-never-leaves-this-process";
const signature = calculateJekoWebhookSignature(directPayload, secret);
assert.equal(verifyJekoWebhookSignature(directPayload, signature, secret), true);
assert.equal(verifyJekoWebhookSignature(directPayload, `sha256=${signature}`, secret), true);
assert.equal(verifyJekoWebhookSignature(`${directPayload} `, signature, secret), false);
assert.equal(verifyJekoWebhookSignature(directPayload, "0".repeat(64), secret), false);

const parsedDirect = parseJekoWebhookPayload(directPayload);
assert.equal(parsedDirect.eventType, "transaction.completed");
assert.equal(parsedDirect.transaction.id, "txn_test_001");
assert.equal(parsedDirect.dedupeKey, "JEKO:txn_test_001:success");
assert.equal(isJekoIncomingPaymentType(parsedDirect.transaction.transactionType), true);

const envelopePayload = JSON.stringify({
  event: "transaction.completed",
  data: JSON.parse(directPayload),
  timestamp: "2026-07-27T10:00:01.000Z",
});
const parsedEnvelope = parseJekoWebhookPayload(envelopePayload);
assert.equal(parsedEnvelope.transaction.transactionDetails.reference, "JEKO-MP-TEST-ABCDEF");
assert.equal(parsedEnvelope.dedupeKey, parsedDirect.dedupeKey);
assert.equal(isJekoIncomingPaymentType("transfer"), false);
assert.throws(() => parseJekoWebhookPayload("not-json"), /non JSON/);

const webhookRoute = readFileSync(
  new URL("../src/app/api/webhooks/jeko/route.ts", import.meta.url),
  "utf8",
);
assert.match(
  webhookRoute,
  /\["not_found",\s*"pending"\]\.includes\(result\.action\)\s*\?\s*503\s*:\s*200/g,
  "un état transitoire doit demander une nouvelle livraison webhook",
);

const cronRoute = readFileSync(
  new URL("../src/app/api/cron/jeko-reconciliation/route.ts", import.meta.url),
  "utf8",
);
assert.match(cronRoute, /authorization[\s\S]*?`Bearer \$\{cronSecret\}`/);
assert.match(cronRoute, /runJekoReconciliationSweep\(\)/);

const sweeper = readFileSync(
  new URL("../src/lib/jeko-reconciliation-sweeper.ts", import.meta.url),
  "utf8",
);
assert.match(sweeper, /attempt\."status" = 'REQUESTING'/);
assert.match(sweeper, /attempt\."providerOrderId" IS NOT NULL/);
assert.match(sweeper, /claimJekoPaymentAttemptSweepCandidates/);
assert.equal(sweeper.match(/FOR UPDATE SKIP LOCKED/g)?.length, 2);
assert.match(sweeper, /reconcileJekoPaymentAttempt/);
assert.match(sweeper, /reconcileJekoReschedulePaymentAttempt/);
assert.match(sweeper, /verifyJekoTeacherPayoutRecord/);

const recovery = readFileSync(
  new URL("../src/lib/jeko-payment-request-recovery.ts", import.meta.url),
  "utf8",
);
assert.match(recovery, /recoverJekoPaymentRequestByReference/);
assert.match(recovery, /JEKO_REFERENCE_RECOVERY_PENDING/);
assert.match(recovery, /recipientType:\s*"ADMIN"/);
assert.match(recovery, /Aucun nouveau POST/);

const vercelConfig = JSON.parse(readFileSync(
  new URL("../vercel.json", import.meta.url),
  "utf8",
));
assert.deepEqual(
  vercelConfig.crons.find((cron) => cron.path === "/api/cron/jeko-reconciliation"),
  { path: "/api/cron/jeko-reconciliation", schedule: "*/10 * * * *" },
);

console.log("Jèko backend verification passed: money, HMAC, transient retries and scheduled reconciliation.");
