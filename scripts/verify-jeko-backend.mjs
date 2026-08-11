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
const {
  buildCanonicalJekoCheckoutUrl,
  isAllowedJekoRedirectUrl: isAllowedJekoCheckoutUrl,
  resolveJekoCheckoutUrl,
} = jiti("../src/lib/jeko-checkout-url.ts");
const {
  JEKO_COMPETENCE_STORE_NAME,
  assertCompetenceJekoStoreName,
  isCompetenceJekoStoreName,
  isForbiddenJekoStoreName,
} = jiti("../src/lib/jeko-store-identity.ts");
const {
  getVerifiedClientPaymentTransaction,
  hasCompletedClientPaymentProviderProof,
  hasVerifiedClientPayment,
} = jiti("../src/lib/payment-security.ts");

assert.equal(xofToJekoAmountCents(1), 100);
assert.equal(xofToJekoAmountCents(10_000), 1_000_000);
assert.equal(jekoAmountCentsToXof(1_000_000), 10_000);
assert.equal(jekoFeeCentsToCoveredXof(15_000), 150);
assert.equal(jekoFeeCentsToCoveredXof(151), 2, "les frais techniques sont couverts sans sous-estimation");
assert.throws(() => xofToJekoAmountCents(0));
assert.throws(() => xofToJekoAmountCents(1.5));
assert.throws(() => xofToJekoAmountCents(21_474_837));
assert.throws(() => jekoAmountCentsToXof(101), /nombre entier de FCFA/);
assert.equal(JEKO_COMPETENCE_STORE_NAME, "Boutique Compétence");
assert.equal(isCompetenceJekoStoreName("Boutique Compétence"), true);
assert.equal(isCompetenceJekoStoreName("Competence CI"), true);
assert.equal(isForbiddenJekoStoreName("Buildify"), true);
assert.equal(isForbiddenJekoStoreName("Bluidify"), true);
assert.doesNotThrow(() => assertCompetenceJekoStoreName("Boutique Compétence"));
assert.throws(() => assertCompetenceJekoStoreName("Buildify"), /Buildify\/Bluidify/);
assert.throws(() => assertCompetenceJekoStoreName("Autre boutique"), /Boutique Compétence/);

assert.equal(
  isAllowedJekoRedirectUrl("https://pay.jeko.africa/payment/d22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc"),
  true,
);
assert.equal(
  buildCanonicalJekoCheckoutUrl("d22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc"),
  "https://pay.jeko.africa/payment/d22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc",
);
assert.equal(
  isAllowedJekoCheckoutUrl("https://pay.jeko.africa/pr/c4"),
  true,
  "la page mobile Jèko courte /pr/... doit être autorisée",
);
assert.equal(
  isAllowedJekoCheckoutUrl("https://pay.jeko.africa/c/abc123def456"),
  true,
  "les liens de paiement Jèko documentés /c/... restent autorisés",
);
assert.equal(
  resolveJekoCheckoutUrl(
    "d22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc",
    "https://pay.jeko.africa/pr/c4",
  ),
  "https://pay.jeko.africa/pr/c4",
);
assert.equal(isAllowedJekoCheckoutUrl("https://pay.jeko.africa/payment/abc"), false);
assert.equal(isAllowedJekoCheckoutUrl("https://pay.jeko.africa/payment/018f1f6e-7b2d-7c10-8a52-93bd728b39ac"), true);
assert.equal(isAllowedJekoCheckoutUrl("https://pay.jeko.africa/payment/d22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc?next=x"), false);
assert.equal(isAllowedJekoCheckoutUrl("https://pay.jeko.africa/payment/d22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc#fragment"), false);
assert.equal(isAllowedJekoCheckoutUrl(
  "https://pay.jeko.africa/payment/d22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc",
  "287830f1-9179-4eba-a7e8-e8e11c8621fa",
), false);
assert.equal(isAllowedJekoRedirectUrl("http://pay.jeko.africa/payment/abc"), false);
assert.equal(isAllowedJekoRedirectUrl("https://pay.jeko.africa.evil.example/payment/abc"), false);
assert.equal(isAllowedJekoRedirectUrl("https://evil.example/?next=https://pay.jeko.africa/payment/abc"), false);
assert.equal(isAllowedJekoRedirectUrl("https://pay.jeko.africa/pr/c4?next=https://evil.example"), false);
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

const verifiedAt = new Date("2026-07-27T10:00:00.000Z");
assert.equal(hasCompletedClientPaymentProviderProof({
  paymentProvider: "JEKO",
  providerPaymentStatus: "SUCCESS",
  paymentVerifiedAt: verifiedAt,
}), true);
assert.equal(hasCompletedClientPaymentProviderProof({
  paydunyaStatus: "COMPLETED",
  paydunyaVerifiedAt: verifiedAt,
}), true);
assert.equal(hasCompletedClientPaymentProviderProof({
  paymentProvider: "JEKO",
  providerPaymentStatus: "SUCCESS",
  paymentVerifiedAt: null,
}), false);
assert.equal(getVerifiedClientPaymentTransaction({
  totalClientPays: 10_000,
  totalPrice: 10_000,
  transactions: [
    { type: "CLIENT_PAYMENT", status: "BLOCKED", amount: 9_999 },
    { type: "CLIENT_PAYMENT", status: "BLOCKED", amount: 10_000 },
  ],
})?.amount, 10_000);
assert.equal(hasVerifiedClientPayment({
  status: "PENDING_PAYMENT",
  paymentStatus: "FAILED",
  totalClientPays: 10_000,
  totalPrice: 10_000,
  paymentProvider: "JEKO",
  providerPaymentStatus: "PENDING",
  paymentVerifiedAt: null,
  transactions: [],
}), false, "an abandoned checkout must never become a verified client payment");

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

const jekoClient = readFileSync(
  new URL("../src/lib/jeko.ts", import.meta.url),
  "utf8",
);
const jekoCheckoutPreview = readFileSync(
  new URL("../src/components/shared/jeko-hosted-checkout-preview.tsx", import.meta.url),
  "utf8",
);
const clientBookingForm = readFileSync(
  new URL("../src/app/client/reserver/reserver-form.tsx", import.meta.url),
  "utf8",
);
const clientPaymentsPage = readFileSync(
  new URL("../src/app/client/paiements/page.tsx", import.meta.url),
  "utf8",
);
assert.match(
  jekoClient,
  /paymentMethod:\s*z\.string\(\)\.trim\(\)\.min\(1\)\.nullable\(\)\.optional\(\)/,
  "une confirmation GET historique sans paymentMethod doit rester réconciliable",
);
assert.match(
  jekoClient,
  /response\.paymentMethod\?\.toLowerCase\(\)\s*!==\s*paymentMethod/,
  "la création POST doit toujours rejeter une réponse sans la méthode attendue",
);
assert.match(jekoClient, /assertCompetenceJekoStoreName/);
assert.match(jekoClient, /JEKO_STORE_MISMATCH/);
assert.match(jekoClient, /raw\.storeName/);
assert.match(jekoClient, /raw\.merchantName/);
const reconciliation = readFileSync(
  new URL("../src/lib/jeko-reconciliation.ts", import.meta.url),
  "utf8",
);
assert.match(
  reconciliation,
  /confirmation\.paymentMethod\s*\?\?\s*fromPlatformPaymentMethod\(attempt\.method\)/,
  "la réconciliation doit reprendre la méthode locale figée quand Jèko l'omet",
);
assert.match(jekoCheckoutPreview, /merchantName = "Boutique Compétence"/);
assert.match(jekoCheckoutPreview, /data-jeko-checkout-merchant/);
assert.match(jekoCheckoutPreview, /data-jeko-checkout-amount/);
assert.match(jekoCheckoutPreview, /data-jeko-checkout-phone-placeholder/);
assert.match(jekoCheckoutPreview, /data-jeko-checkout-disabled-button/);
assert.match(jekoCheckoutPreview, /data-jeko-secured-by-competence/);
assert.match(jekoCheckoutPreview, /Payer par <span className="font-black text-\[#111827\]">\{methodDisplay\}<\/span>/);
assert.match(jekoCheckoutPreview, /Paiement sécurisé par <span className="font-black text-\[#4938B8\]">Jèko<\/span>/);
assert.match(clientBookingForm, /merchantName="Boutique Compétence"/);
assert.match(clientPaymentsPage, /merchantName="Boutique Compétence"/);
for (const source of [jekoCheckoutPreview, clientBookingForm, clientPaymentsPage]) {
  assert.doesNotMatch(source, /Buildify|Bluidify/i, "la boutique visible côté client doit rester Compétence");
}

const recovery = readFileSync(
  new URL("../src/lib/jeko-payment-request-recovery.ts", import.meta.url),
  "utf8",
);
assert.match(recovery, /recoverJekoPaymentRequestByReference/);
assert.match(recovery, /JEKO_REFERENCE_RECOVERY_PENDING/);
assert.match(recovery, /recipientType:\s*"ADMIN"/);
assert.match(recovery, /Aucun nouveau POST/);

const paymentAudit = readFileSync(
  new URL("./audit-payment-integrity.mjs", import.meta.url),
  "utf8",
);
const paymentQuarantine = readFileSync(
  new URL("./quarantine-unverified-payments.mjs", import.meta.url),
  "utf8",
);
for (const source of [paymentAudit, paymentQuarantine]) {
  assert.match(source, /hasCompletedClientPaymentProviderProof/);
  assert.match(source, /getVerifiedClientPaymentTransaction/);
  assert.doesNotMatch(source, /hasCompletedPayDunyaProof/);
  assert.doesNotMatch(source, /getVerifiedPayDunyaClientPaymentTransaction/);
}
assert.match(paymentAudit, /verifiedStatusWithoutProviderProof/);
assert.match(paymentAudit, /hasVerifiedClientPayment\(booking\)/);
assert.match(paymentQuarantine, /providerPaymentStatus:\s*"REJECTED"/);
assert.match(paymentQuarantine, /paymentVerifiedAt:\s*null/);

const vercelConfig = JSON.parse(readFileSync(
  new URL("../vercel.json", import.meta.url),
  "utf8",
));
assert.deepEqual(
  vercelConfig.crons.find((cron) => cron.path === "/api/cron/jeko-reconciliation"),
  { path: "/api/cron/jeko-reconciliation", schedule: "*/10 * * * *" },
);

console.log("Jèko backend verification passed: money, HMAC, transient retries and scheduled reconciliation.");
