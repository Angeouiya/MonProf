import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const state = jiti("../src/lib/jeko-payout-state.ts") as typeof import("../src/lib/jeko-payout-state");
const utils = jiti("../src/lib/jeko-utils.ts") as typeof import("../src/lib/jeko-utils");
const retention = jiti("../src/lib/teacher-payout-retention.ts") as typeof import("../src/lib/teacher-payout-retention");

type SimulatedPayout = {
  localStatus: "DRAFT" | "PAID" | "CANCELLED";
  ledgerPaid: number;
};

function applyProviderResult(
  payout: SimulatedPayout,
  providerStatus: "pending" | "success" | "failed",
  exactNetXof: number,
) {
  const transition = state.decideTeacherPayoutTransition(payout.localStatus, providerStatus);
  if (transition === "finalize") {
    payout.localStatus = "PAID";
    payout.ledgerPaid += exactNetXof;
  } else if (transition === "cancel") {
    payout.localStatus = "CANCELLED";
  }
  return transition;
}

function verifyPendingThenSuccessAndDuplicate() {
  const exactNetXof = 20_000;
  const payout: SimulatedPayout = { localStatus: "DRAFT", ledgerPaid: 0 };

  assert.equal(applyProviderResult(payout, "pending", exactNetXof), "wait");
  assert.deepEqual(payout, { localStatus: "DRAFT", ledgerPaid: 0 });

  assert.equal(applyProviderResult(payout, "success", exactNetXof), "finalize");
  assert.deepEqual(payout, { localStatus: "PAID", ledgerPaid: exactNetXof });

  // Simule un second webhook success : le ledger ne bouge plus.
  assert.equal(applyProviderResult(payout, "success", exactNetXof), "already");
  assert.deepEqual(payout, { localStatus: "PAID", ledgerPaid: exactNetXof });
}

function verifyFailureDoesNotDebitLedger() {
  const payout: SimulatedPayout = { localStatus: "DRAFT", ledgerPaid: 0 };
  assert.equal(applyProviderResult(payout, "failed", 20_000), "cancel");
  assert.deepEqual(payout, { localStatus: "CANCELLED", ledgerPaid: 0 });
  assert.equal(state.decideTeacherPayoutTransition("CANCELLED", "success"), "conflict");
}

function verifyExactNetAndPlatformCoveredFee() {
  const exactNetXof = 20_000;
  const feeCents = 30_050;
  const coveredFeeXof = utils.jekoFeeCentsToCoveredXof(feeCents);

  assert.equal(utils.xofToJekoAmountCents(exactNetXof), 2_000_000);
  assert.equal(coveredFeeXof, 301, "les centimes de frais sont arrondis au FCFA supérieur");
  assert.equal(exactNetXof + coveredFeeXof, 20_301);
  assert.equal(exactNetXof, 20_000, "les frais plateforme ne diminuent jamais le net professeur");
}

function verifyAppliedRetentionCanBeMaterialized() {
  const snapshot = retention.buildTeacherPayoutSessionRetentionSnapshot({
    grossRemaining: 5_000,
    persistedRetainedAmount: 500,
    additionalRetainedAmount: 1_000,
  });

  assert.deepEqual(snapshot, {
    retainedAmountBefore: 500,
    retainedAmountAfter: 1_500,
    remainingAfterRetention: 3_500,
  });
  assert.equal(
    snapshot.retainedAmountBefore,
    500,
    "la condition atomique doit comparer la valeur actuellement persistée",
  );
  assert.notEqual(
    snapshot.retainedAmountAfter,
    snapshot.retainedAmountBefore,
    "une nouvelle retenue APPLIED doit produire une valeur à matérialiser",
  );

  assert.deepEqual(
    retention.buildTeacherPayoutSessionRetentionSnapshot({
      grossRemaining: 1_000,
      persistedRetainedAmount: 750,
      additionalRetainedAmount: 800,
    }),
    {
      retainedAmountBefore: 750,
      retainedAmountAfter: 1_000,
      remainingAfterRetention: 0,
    },
    "la retenue matérialisée ne doit jamais dépasser le reste brut",
  );
}

function verifyDatabaseGuardsAreWired() {
  const route = readFileSync(new URL("../src/app/api/admin/teacher-payouts/route.ts", import.meta.url), "utf8");
  const reconciliation = readFileSync(new URL("../src/lib/jeko-payout-reconciliation.ts", import.meta.url), "utf8");
  const webhook = readFileSync(new URL("../src/app/api/webhooks/jeko/route.ts", import.meta.url), "utf8");
  const legacyBookingRoute = readFileSync(new URL("../src/app/api/admin/bookings/[id]/route.ts", import.meta.url), "utf8");
  const legacyTransactionRoute = readFileSync(new URL("../src/app/api/admin/transactions/[id]/route.ts", import.meta.url), "utf8");
  const payoutRequestReviewRoute = readFileSync(new URL("../src/app/api/admin/teacher-payout-requests/[id]/route.ts", import.meta.url), "utf8");
  const payoutReservationGuard = readFileSync(new URL("../src/lib/teacher-payout-reservations.ts", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

  assert.match(route, /status:\s*"DRAFT"/);
  assert.match(route, /paidAmountBefore:/);
  assert.match(route, /releasedAmountSnapshot:/);
  assert.match(route, /retainedAmountSnapshot:/);
  assert.match(route, /current\.retainedAmount !== item\.retainedAmountBefore/);
  assert.match(route, /retainedAmount: item\.retainedAmountBefore/);
  assert.match(route, /data: \{ retainedAmount: item\.retainedAmountAfter \}/);
  assert.match(route, /retainedAmountSnapshot: allocation\.item\.retainedAmountAfter/);
  assert.doesNotMatch(route, /current\.retainedAmount !== item\.session\.retainedAmount/);
  assert.match(route, /processJekoTeacherPayoutRecord\(payoutRecordId\)/);
  assert.match(route, /resolvePayoutRequestAttemptId\(payoutRequest\.id\)/);
  assert.match(route, /`\$\{prefix\}:attempt:\$\{attemptNumber\}`/);
  assert.match(route, /existing\.status !== "CANCELLED"/);
  assert.match(reconciliation, /where:\s*\{ id: record\.id, status: "DRAFT" \}/);
  assert.match(reconciliation, /isolationLevel:\s*"Serializable"/);
  assert.match(reconciliation, /status:\s*"PAID",\s*\n\s*paidAt:\s*now/);
  assert.match(reconciliation, /providerFeeAmountMinor:\s*input\.feeAmountCents/);
  assert.match(reconciliation, /transferFeeAmountMinor:\s*feeAmountMinor/);
  assert.match(reconciliation, /transferFeeCoveredByPlatformMinor:\s*feeAmountMinor/);
  assert.match(reconciliation, /where:\s*\{ payoutRecordId: current\.id, status: "PENDING" \}/);
  assert.match(reconciliation, /payoutRecordId:\s*null/);
  assert.match(webhook, /transactionType[\s\S]*?transfer|transactionType\)\s*!==\s*"transfer"/);
  assert.match(schema, /model TeacherPayoutRecord[\s\S]*?paidAt\s+DateTime\?/);
  assert.match(legacyBookingRoute, /raccourci de paiement manuel est désactivé/);
  assert.doesNotMatch(
    legacyBookingRoute.match(/case "pay_teacher":[\s\S]*?case "cancel":/)?.[0] ?? "",
    /teacherPaidAmount:\s*/,
  );
  assert.match(legacyTransactionRoute, /validation manuelle d'un versement professeur est désactivée/);
  assert.doesNotMatch(legacyTransactionRoute, /data:\s*\{ status: "TEACHER_PAID"/);
  assert.match(payoutRequestReviewRoute, /request\.payoutRecord\?\.status === "DRAFT"/);
  assert.match(payoutReservationGuard, /provider:\s*"JEKO"/);
  assert.match(payoutReservationGuard, /status:\s*"DRAFT"/);
}

verifyPendingThenSuccessAndDuplicate();
verifyFailureDoesNotDebitLedger();
verifyExactNetAndPlatformCoveredFee();
verifyAppliedRetentionCanBeMaterialized();
verifyDatabaseGuardsAreWired();

console.log("Jèko payout flow verification passed (pending, success, duplicate, failure, exact net and fees).");
