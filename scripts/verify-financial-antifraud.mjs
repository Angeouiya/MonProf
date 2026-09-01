import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  validateJekoBookingFinancialSnapshot,
} = jiti("../src/lib/jeko-client-payment.ts");
const {
  calculateJekoClientPaymentFee,
} = jiti("../src/lib/jeko-client-payment-fees.ts");

const courseAmount = 20_000;
const transportFee = 1_000;
const materialFee = 0;
const paymentServiceFeeAmount = 630;
const providerFeeAmount = calculateJekoClientPaymentFee(
  courseAmount + transportFee + materialFee + paymentServiceFeeAmount,
  "wave",
).amount;
const totalClientPays = courseAmount
  + transportFee
  + materialFee
  + paymentServiceFeeAmount
  + providerFeeAmount;

const valid = {
  courseAmount,
  transportFee,
  materialFee,
  paymentServiceFeeAmount,
  commissionAmount: 6_000,
  teacherPayoutAmount: 14_000,
  totalTeacherReceives: 15_000,
  totalClientPays,
  totalPrice: totalClientPays,
  paymentMethod: "wave",
  pricingSnapshot: JSON.stringify({
    courseAmount,
    transportFee,
    materialFee,
    paymentServiceFeeAmount,
    paymentProviderFeeAmount: providerFeeAmount,
    paymentProviderFeeMethod: "wave",
    platformCommissionAmount: 6_000,
    teacherPayoutAmount: 14_000,
    totalTeacherReceives: 15_000,
    totalClientPays,
  }),
};

assert.equal(validateJekoBookingFinancialSnapshot(valid), null);
assert.match(
  validateJekoBookingFinancialSnapshot({ ...valid, totalClientPays: totalClientPays - 1 }),
  /ne correspond pas/i,
);
assert.match(
  validateJekoBookingFinancialSnapshot({ ...valid, paymentServiceFeeAmount: 1 }),
  /ne correspond pas/i,
);
assert.match(
  validateJekoBookingFinancialSnapshot({ ...valid, commissionAmount: 5_999 }),
  /ne correspond pas/i,
);
assert.match(
  validateJekoBookingFinancialSnapshot({
    ...valid,
    pricingSnapshot: JSON.stringify({
      ...JSON.parse(valid.pricingSnapshot),
      paymentProviderFeeMethod: "orange",
    }),
  }),
  /moyen Jèko/i,
);
assert.match(
  validateJekoBookingFinancialSnapshot({ ...valid, pricingSnapshot: "{invalid" }),
  /absent ou invalide/i,
);

const paymentProvider = read("../src/lib/payment-provider.ts");
const payoutRoute = read("../src/app/api/professor/payout-requests/route.ts");
const payoutForm = read("../src/components/professor/teacher-payout-request-form.tsx");
const professorProfileRoute = read("../src/app/api/professor/profile/route.ts");
const professorSettings = read("../src/app/professeur/(espace)/parametres/settings-client.tsx");
const teacherPayouts = read("../src/lib/teacher-jeko-payouts.ts");
const webhookRoute = read("../src/app/api/webhooks/jeko/route.ts");
const reconciliation = read("../src/lib/jeko-reconciliation.ts");
const payoutReconciliation = read("../src/lib/jeko-payout-reconciliation.ts");
const riskRadar = read("../src/lib/operational-risk-radar.ts");

assert.match(paymentProvider, /validateJekoBookingFinancialSnapshot/);
assert.match(paymentProvider, /Contrôle anti-fraude du paiement refusé/);
assert.match(payoutRoute, /bcrypt\.compare\(currentPassword, teacher\.portalPasswordHash\)/);
assert.match(payoutRoute, /PAYOUT_REAUTHENTICATION_FAILED/);
assert.match(payoutRoute, /MAX_POST_BODY_BYTES/);
assert.match(payoutForm, /teacher-payout-current-password/);
assert.match(payoutForm, /currentPassword/);
assert.match(payoutForm, /RestrictionNoticeDialog/);
assert.doesNotMatch(payoutForm, /toast\.error/);
assert.match(professorProfileRoute, /bcrypt\.compare\(currentPassword, stored\.portalPasswordHash\)/);
assert.match(professorProfileRoute, /PAYOUT_PROFILE_REAUTHENTICATION_FAILED/);
assert.match(professorSettings, /teacher-payout-profile-current-password/);
assert.match(teacherPayouts, /TEACHER_PAYOUT_MAX_NEW_ATTEMPTS_PER_HOUR = 5/);
assert.match(teacherPayouts, /TEACHER_PAYOUT_MAX_NEW_ATTEMPTS_PER_DAY = 12/);
assert.match(teacherPayouts, /lockTeacherPayoutBalance[\s\S]*assertTeacherPayoutVelocity/);
assert.match(webhookRoute, /verifyJekoWebhookSignature/);
assert.match(reconciliation, /confirmJekoPaymentRequest/);
assert.match(reconciliation, /incoming\.amount\.amount !== attempt\.providerAmountMinor/);
assert.match(payoutReconciliation, /getJekoTeacherPayoutTransfer/);
assert.match(payoutReconciliation, /bénéficiaire webhook différent/);
assert.match(riskRadar, /jekoPaymentIntegrityMismatches/);
assert.match(riskRadar, /jekoPayoutIntegrityMismatches/);

console.log("OK anti-fraude financier : prix serveur, réauthentification, vélocité, preuve Jèko et radar d'intégrité vérifiés.");

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
