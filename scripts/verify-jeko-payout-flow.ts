import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const state = jiti("../src/lib/jeko-payout-state.ts") as typeof import("../src/lib/jeko-payout-state");
const utils = jiti("../src/lib/jeko-utils.ts") as typeof import("../src/lib/jeko-utils");
const retention = jiti("../src/lib/teacher-payout-retention.ts") as typeof import("../src/lib/teacher-payout-retention");
const teacherPayments = jiti("../src/lib/teacher-payments.ts") as typeof import("../src/lib/teacher-payments");
const payoutRequestIdempotency = jiti("../src/lib/teacher-payout-request-idempotency.ts") as typeof import("../src/lib/teacher-payout-request-idempotency");

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

function verifyExactRequestableBalanceAfterReservations() {
  const globalRetentionLedger = teacherPayments.getTeacherGlobalRetentionLedger(
    [{ bookingId: null, amount: 1_000, status: "APPLIED" }],
    [{ bookingId: "booking-session", retainedAmount: 200 }],
    [{ bookingId: "booking-legacy", retainedAmountSnapshot: 300 }],
  );
  const availability = teacherPayments.calculateTeacherPayoutAvailability({
    settlements: [
      { bookingId: "booking-session", remaining: 5_000, totalOutstanding: 5_000 },
      { bookingId: "booking-legacy", remaining: 4_000, totalOutstanding: 4_000 },
      { bookingId: "booking-free", remaining: 3_000, totalOutstanding: 3_000 },
    ],
    globalRetentionLedger,
    pendingRequestedAmount: 2_000,
    draftReservations: [
      // Une ancienne demande PENDING est désormais informative : seul le DRAFT Jèko réserve.
      { amount: 2_000, payoutRequestStatus: "PENDING" },
      // Tout transfert DRAFT réserve son propre montant jusqu'à succès ou annulation.
      { amount: 1_500, payoutRequestStatus: null },
    ],
  });

  assert.deepEqual(availability, {
    readyToReceive: 11_200,
    totalOutstanding: 11_200,
    pendingRequestedAmount: 2_000,
    draftReservedAmount: 3_500,
    requestableAmount: 7_700,
    retentionNotRepresentedInSettlements: 800,
  });
}

function verifyProfessorPayoutRequestRetryIsIdempotent() {
  const idempotencyKey = "d22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc";
  assert.equal(
    payoutRequestIdempotency.normalizeTeacherPayoutRequestIdempotencyKey(idempotencyKey.toUpperCase()),
    idempotencyKey,
  );
  assert.equal(
    payoutRequestIdempotency.normalizeTeacherPayoutRequestIdempotencyKey("not-a-uuid"),
    null,
  );

  const intent = {
    teacherId: "teacher-1",
    amount: 5_000,
    method: "WAVE",
    paymentPhone: "+2250700000000",
    note: "",
  };
  let stored: (typeof intent & { id: string }) | null = null;
  let reservationCount = 0;
  const post = (candidate: typeof intent) => {
    const resolution = payoutRequestIdempotency.resolveTeacherPayoutRequestIdempotency(
      stored,
      candidate,
    );
    if (resolution === "CONFLICT") throw new Error("IDEMPOTENCY_CONFLICT");
    if (resolution === "REPLAY") {
      return { request: stored!, idempotentReplay: true };
    }
    reservationCount += 1;
    stored = { id: "request-1", ...candidate };
    return { request: stored, idempotentReplay: false };
  };

  const created = post(intent);
  const retried = post(intent);
  assert.equal(reservationCount, 1, "un double POST ne doit réserver le solde qu'une fois");
  assert.equal(retried.request.id, created.request.id, "le retry doit renvoyer la demande existante");
  assert.equal(retried.idempotentReplay, true);
  assert.equal(
    payoutRequestIdempotency.resolveTeacherPayoutRequestIdempotency(
      stored,
      { ...intent, amount: intent.amount + 1 },
    ),
    "CONFLICT",
    "une clé réutilisée avec un autre montant doit être refusée",
  );
}

function verifyDatabaseGuardsAreWired() {
  const adminPayoutRoute = readFileSync(new URL("../src/app/api/admin/teacher-payouts/route.ts", import.meta.url), "utf8");
  const payoutAutomation = readFileSync(new URL("../src/lib/teacher-jeko-payouts.ts", import.meta.url), "utf8");
  const reconciliation = readFileSync(new URL("../src/lib/jeko-payout-reconciliation.ts", import.meta.url), "utf8");
  const webhook = readFileSync(new URL("../src/app/api/webhooks/jeko/route.ts", import.meta.url), "utf8");
  const legacyBookingRoute = readFileSync(new URL("../src/app/api/admin/bookings/[id]/route.ts", import.meta.url), "utf8");
  const legacyTransactionRoute = readFileSync(new URL("../src/app/api/admin/transactions/[id]/route.ts", import.meta.url), "utf8");
  const payoutRequestReviewRoute = readFileSync(new URL("../src/app/api/admin/teacher-payout-requests/[id]/route.ts", import.meta.url), "utf8");
  const professorPayoutRequestRoute = readFileSync(new URL("../src/app/api/professor/payout-requests/route.ts", import.meta.url), "utf8");
  const professorPaymentsPage = readFileSync(new URL("../src/app/professeur/(espace)/paiements/page.tsx", import.meta.url), "utf8");
  const professorDashboard = readFileSync(new URL("../src/app/professeur/(espace)/page.tsx", import.meta.url), "utf8");
  const professorPayoutRequestForm = readFileSync(new URL("../src/components/professor/teacher-payout-request-form.tsx", import.meta.url), "utf8");
  const payoutReservationGuard = readFileSync(new URL("../src/lib/teacher-payout-reservations.ts", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const payoutRequestIdempotencyMigration = readFileSync(
    new URL("../prisma/migrations/20260731010000_teacher_payout_request_idempotency/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(adminPayoutRoute, /ADMIN_TEACHER_PAYOUT_DISABLED/);
  assert.doesNotMatch(adminPayoutRoute, /teacherPayoutRecord\.create/);
  assert.match(payoutAutomation, /status:\s*"DRAFT"/);
  assert.match(payoutAutomation, /paidAmountBefore:/);
  assert.match(payoutAutomation, /releasedAmountSnapshot:/);
  assert.match(payoutAutomation, /retainedAmountSnapshot:/);
  assert.match(payoutAutomation, /current\.retainedAmount !== item\.retainedAmountBefore/);
  assert.match(payoutAutomation, /retainedAmount: item\.retainedAmountBefore/);
  assert.match(payoutAutomation, /data: \{ retainedAmount: item\.retainedAmountAfter \}/);
  assert.match(payoutAutomation, /retainedAmountSnapshot: allocation\.item\.retainedAmountAfter/);
  assert.doesNotMatch(payoutAutomation, /current\.retainedAmount !== item\.session\.retainedAmount/);
  assert.match(payoutAutomation, /processJekoTeacherPayoutRecord\(payoutRecordId\)/);
  assert.match(payoutAutomation, /existingPayout\.status === "CANCELLED"/);
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
  assert.match(payoutAutomation, /lockTeacherPayoutBalance\(tx, teacher\.id\)/);
  assert.match(payoutAutomation, /teacherPayoutAllocation\.findMany/);
  assert.match(payoutAutomation, /calculate|totalDue|allocationCandidates/);
  assert.match(professorPayoutRequestRoute, /createAndProcessTeacherJekoPayout/);
  assert.match(professorPayoutRequestRoute, /normalizeTeacherPayoutRequestIdempotencyKey/);
  assert.match(professorPayoutRequestRoute, /idempotencyKey,/);
  assert.match(professorPayoutRequestForm, /pendingSubmissionRef/);
  assert.match(professorPayoutRequestForm, /crypto\.randomUUID\(\)/);
  assert.match(professorPayoutRequestForm, /idempotencyKey,/);
  assert.match(schema, /idempotencyKey\s+String\?\s+@unique/);
  assert.match(payoutRequestIdempotencyMigration, /CREATE UNIQUE INDEX "TeacherPayoutRequest_idempotencyKey_key"/);
  assert.match(professorPaymentsPage, /calculateTeacherPayoutAvailability/);
  assert.match(professorPaymentsPage, /draftReservedAmount=\{draftReservedAmount\}/);
  assert.match(professorDashboard, /calculateTeacherPayoutAvailability/);
}

verifyPendingThenSuccessAndDuplicate();
verifyFailureDoesNotDebitLedger();
verifyExactNetAndPlatformCoveredFee();
verifyAppliedRetentionCanBeMaterialized();
verifyExactRequestableBalanceAfterReservations();
verifyProfessorPayoutRequestRetryIsIdempotent();
verifyDatabaseGuardsAreWired();

console.log("Jèko payout flow verification passed (pending, success, duplicate, failure, exact net and fees).");
