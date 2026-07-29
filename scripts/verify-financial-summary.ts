import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildPlatformFinancialSummary,
  providerFeeFinancialFields,
  sumProviderFeeAmounts,
  type FinancialRescheduleLine,
} from "../src/lib/financial-summary";
import {
  getMaterializedTeacherGlobalRetention,
  getTeacherGlobalRetentionLedger,
} from "../src/lib/teacher-payments";

const summary = buildPlatformFinancialSummary([
  {
    totalClientPays: 23_690,
    courseAmount: 20_000,
    transportFee: 3_000,
    paymentServiceFeeAmount: 690,
    commissionAmount: 6_000,
    teacherNetAmount: 17_000,
    providerFeeAmountXof: 356,
  },
  {
    totalClientPays: 10_300,
    courseAmount: 10_000,
    transportFee: 0,
    paymentServiceFeeAmount: 300,
    commissionAmount: 3_000,
    teacherNetAmount: 7_000,
    providerFeeAmountXof: 155,
  },
], [
  { amount: 20_000, transferFeeCoveredByPlatform: 300 },
]);

assert.deepEqual(summary, {
  clientGross: 33_990,
  refundsPaid: 0,
  clientNetCollected: 33_990,
  baseClientGross: 33_990,
  rescheduleGross: 0,
  courseRevenue: 30_000,
  transportCollected: 3_000,
  rescheduleFeesCollected: 0,
  serviceFeesCollected: 990,
  rescheduleServiceFees: 0,
  providerCollectionFees: 511,
  rescheduleProviderFees: 0,
  commissionRevenue: 9_000,
  rescheduleCommissionRevenue: 0,
  teacherNetGenerated: 24_000,
  rescheduleTeacherNetGenerated: 0,
  cancellationTeacherNetGenerated: 0,
  teacherPaid: 20_000,
  teacherRetained: 0,
  teacherRemaining: 4_000,
  teacherOverpaid: 0,
  transferFeesCovered: 300,
  serviceFeesRemaining: 179,
});

function paidReport(overrides: Partial<FinancialRescheduleLine> = {}): FinancialRescheduleLine {
  return {
    totalToPay: 2_060,
    feeAmount: 2_000,
    paymentServiceFeeAmount: 60,
    feePlatformAmount: 800,
    feeTeacherAmount: 1_200,
    providerFeeAmountXof: 31,
    status: "APPLIED",
    transactionStatus: "BLOCKED",
    paidAt: "2026-07-28T10:00:00.000Z",
    ...overrides,
  };
}

const withAppliedReport = buildPlatformFinancialSummary([{
  status: "CONFIRMED",
  totalClientPays: 23_690,
  courseAmount: 20_000,
  transportFee: 3_000,
  paymentServiceFeeAmount: 690,
  // APPLIED already folded the report split into these Booking fields.
  commissionAmount: 6_800,
  teacherNetAmount: 18_200,
  providerFeeAmountXof: 356,
  reschedules: [paidReport()],
}]);

assert.deepEqual(withAppliedReport, {
  clientGross: 25_750,
  refundsPaid: 0,
  clientNetCollected: 25_750,
  baseClientGross: 23_690,
  rescheduleGross: 2_060,
  courseRevenue: 20_000,
  transportCollected: 3_000,
  rescheduleFeesCollected: 2_000,
  serviceFeesCollected: 750,
  rescheduleServiceFees: 60,
  providerCollectionFees: 387,
  rescheduleProviderFees: 31,
  commissionRevenue: 6_800,
  rescheduleCommissionRevenue: 800,
  teacherNetGenerated: 18_200,
  rescheduleTeacherNetGenerated: 1_200,
  cancellationTeacherNetGenerated: 0,
  teacherPaid: 0,
  teacherRetained: 0,
  teacherRemaining: 18_200,
  teacherOverpaid: 0,
  transferFeesCovered: 0,
  serviceFeesRemaining: 363,
});

const awaitingReport = buildPlatformFinancialSummary([{
  status: "CONFIRMED",
  commissionAmount: 6_000,
  teacherNetAmount: 17_000,
  reschedules: [paidReport({ status: "AWAITING_TEACHER" })],
}]);
assert.equal(awaitingReport.commissionRevenue, 6_800);
assert.equal(awaitingReport.teacherNetGenerated, 18_200);

const cancelled = buildPlatformFinancialSummary([{
  status: "CANCELLED",
  totalClientPays: 23_690,
  courseAmount: 20_000,
  transportFee: 3_000,
  paymentServiceFeeAmount: 690,
  commissionAmount: 6_800,
  teacherNetAmount: 18_200,
  teacherPaidAmount: 1_000,
  cancellationPenaltyTeacherAmount: 3_000,
  cancellationPenaltyPlatformAmount: 2_000,
  providerFeeAmountXof: 356,
  reschedules: [paidReport()],
}]);
assert.equal(cancelled.teacherNetGenerated, 3_000, "la pénalité remplace le net complet et le supplément");
assert.equal(cancelled.cancellationTeacherNetGenerated, 3_000);
assert.equal(cancelled.rescheduleTeacherNetGenerated, 0);
assert.equal(cancelled.teacherPaid, 1_000);
assert.equal(cancelled.teacherRemaining, 2_000);
assert.equal(cancelled.commissionRevenue, 2_000, "une annulation ne conserve que la pénalité plateforme réelle");
assert.equal(cancelled.rescheduleCommissionRevenue, 0, "un supplément annulé ne survit pas à la pénalité plateforme");

const refunded = buildPlatformFinancialSummary([{
  status: "REFUNDED",
  totalClientPays: 23_690,
  cancellationPenaltyPlatformAmount: 3_000,
  refunds: [
    { amount: 20_000, status: "REFUNDED" },
    { amount: 500, status: "REFUND_PENDING" },
  ],
}]);
assert.equal(refunded.clientGross, 23_690, "le brut historique reste rapprochable");
assert.equal(refunded.refundsPaid, 20_000, "seuls les remboursements exécutés sont déduits");
assert.equal(refunded.clientNetCollected, 3_690, "le net encaissé déduit les remboursements réels");
assert.equal(refunded.commissionRevenue, 3_000);

const refundPendingReport = buildPlatformFinancialSummary([{
  status: "CONFIRMED",
  commissionAmount: 6_800,
  teacherNetAmount: 18_200,
  reschedules: [paidReport({ transactionStatus: "REFUND_PENDING" })],
}]);
assert.equal(refundPendingReport.rescheduleGross, 2_060, "l'encaissement historique reste visible");
assert.equal(refundPendingReport.rescheduleProviderFees, 31, "le coût prestataire réellement subi reste visible");
assert.equal(refundPendingReport.rescheduleServiceFees, 60, "un remboursement non finalisé conserve provisoirement le 3 % collecté");
assert.equal(refundPendingReport.commissionRevenue, 6_000, "la part remboursable n'est plus un revenu");
assert.equal(refundPendingReport.teacherNetGenerated, 17_000, "la part remboursable n'est plus due au professeur");

const refundedReport = buildPlatformFinancialSummary([{
  status: "CONFIRMED",
  totalClientPays: 23_690,
  paymentServiceFeeAmount: 690,
  // A rejected report is refunded before being applied to the booking split.
  commissionAmount: 6_000,
  teacherNetAmount: 17_000,
  providerFeeAmountXof: 356,
  refunds: [{ amount: 2_060, status: "REFUNDED" }],
  reschedules: [paidReport({ status: "REFUNDED", transactionStatus: "REFUNDED" })],
}]);
assert.equal(refundedReport.clientGross, 25_750, "le brut conserve la trace du supplément encaissé");
assert.equal(refundedReport.refundsPaid, 2_060, "le remboursement du supplément est déduit une seule fois du net client");
assert.equal(refundedReport.clientNetCollected, 23_690);
assert.equal(refundedReport.rescheduleServiceFees, 0, "le 3 % d'un supplément remboursé n'est plus collecté");
assert.equal(refundedReport.serviceFeesCollected, 690, "seuls les frais de service du paiement principal restent collectés");
assert.equal(refundedReport.rescheduleProviderFees, 31, "le coût Jèko du supplément reste un coût réel");
assert.equal(refundedReport.serviceFeesRemaining, 303, "le reste déduit les frais Jèko sans conserver le 3 % remboursé");
assert.equal(refundedReport.rescheduleCommissionRevenue, 0);
assert.equal(refundedReport.rescheduleTeacherNetGenerated, 0);

assert.equal(sumProviderFeeAmounts([
  { providerFeeAmountXof: 356 },
  { providerFeeAmountXof: 31 },
  { providerFeeAmountXof: null },
]), 387, "tous les frais des tentatives Jèko réussies sont additionnés");

const fractionalCollectionFees = providerFeeFinancialFields([
  { providerFeeAmountMinor: 40, providerFeeAmountXof: 1 },
  { providerFeeAmountMinor: 40, providerFeeAmountXof: 1 },
]);
assert.deepEqual(fractionalCollectionFees, {
  providerFeeAmountMinor: 80,
  providerFeeLegacyAmountXof: 0,
  providerFeeAmountXof: 1,
});
const fractionalProviderFees = buildPlatformFinancialSummary(
  [{ paymentServiceFeeAmount: 5, ...fractionalCollectionFees }],
  [
    {
      status: "PAID",
      transferFeeCoveredByPlatformMinor: 40,
      transferFeeCoveredByPlatform: 1,
    },
    {
      status: "CANCELLED",
      transferFeeCoveredByPlatformMinor: 40,
      transferFeeCoveredByPlatform: 1,
    },
  ],
);
assert.equal(
  fractionalProviderFees.providerCollectionFees,
  1,
  "les frais d'encaissement mineurs sont cumulés avant un seul arrondi XOF",
);
assert.equal(
  fractionalProviderFees.transferFeesCovered,
  1,
  "les frais de retrait mineurs sont cumulés avant un seul arrondi XOF",
);
assert.equal(fractionalProviderFees.serviceFeesRemaining, 3);
assert.equal(
  sumProviderFeeAmounts([
    { providerFeeAmountMinor: 40, providerFeeAmountXof: 1 },
    { providerFeeAmountMinor: 40, providerFeeAmountXof: 1 },
    { providerFeeAmountMinor: 0, providerFeeAmountXof: 2 },
  ]),
  3,
  "les lignes historiques XOF restent ajoutées au cumul mineur exact",
);

const subsidized = buildPlatformFinancialSummary(
  [{ paymentServiceFeeAmount: 100, providerFeeAmountXof: 120 }],
  [{ transferFeeCoveredByPlatform: 50, status: "PAID" }],
);
assert.equal(subsidized.serviceFeesRemaining, -70);

const freeCancellation = buildPlatformFinancialSummary([{
  status: "CANCELLED",
  totalClientPays: 10_300,
  courseAmount: 10_000,
  paymentServiceFeeAmount: 300,
  commissionAmount: 3_000,
  teacherNetAmount: 7_000,
  cancellationPenaltyTeacherAmount: 0,
}]);
assert.equal(freeCancellation.teacherNetGenerated, 0);
assert.equal(freeCancellation.teacherRemaining, 0);

const legacySettled = buildPlatformFinancialSummary([
  { teacherNetAmount: 10_000, teacherPaidAmount: 10_000, paidPayoutAllocationAmount: 0 },
  { teacherNetAmount: 8_000, teacherPaidAmount: 8_000, paidPayoutAllocationAmount: 8_000 },
], [
  { amount: 8_000, status: "PAID" },
  { amount: 4_000, status: "DRAFT", transferFeeCoveredByPlatform: 100 },
  { amount: 3_000, status: "CANCELLED", transferFeeCoveredByPlatform: 100 },
]);
assert.equal(legacySettled.teacherPaid, 18_000);
assert.equal(legacySettled.teacherRemaining, 0);
assert.equal(legacySettled.transferFeesCovered, 100, "les frais d'un transfert annulé restent un coût plateforme");

const mixedHistoricalPayout = buildPlatformFinancialSummary([
  {
    teacherNetAmount: 10_000,
    teacherPaidAmount: 10_000,
    paidPayoutAllocationAmount: 6_000,
  },
], [
  { amount: 6_000, status: "PAID" },
]);
assert.equal(mixedHistoricalPayout.teacherPaid, 10_000, "le reliquat historique et l'allocation moderne ne se doublonnent pas");
assert.equal(mixedHistoricalPayout.teacherRemaining, 0);

const historicalOverpayment = buildPlatformFinancialSummary([{
  status: "CANCELLED",
  cancellationPenaltyTeacherAmount: 3_000,
  teacherPaidAmount: 5_000,
}]);
assert.equal(historicalOverpayment.teacherPaid, 5_000, "un décaissement historique réel ne doit pas être masqué par le net dû actuel");
assert.equal(historicalOverpayment.teacherRemaining, 0);
assert.equal(historicalOverpayment.teacherOverpaid, 2_000, "un surpaiement doit être visible comme anomalie");

const retained = buildPlatformFinancialSummary(
  [{ teacherNetAmount: 15_000 }],
  [{ amount: 4_000, status: "PAID" }],
  [
    { amount: 3_000, status: "APPLIED" },
    { amount: 2_000, status: "PENDING" },
  ],
);
assert.equal(retained.teacherPaid, 4_000);
assert.equal(retained.teacherRetained, 3_000);
assert.equal(retained.teacherRemaining, 8_000, "les retenues appliquées réduisent le reste sans devenir un versement");

const materializedGlobalRetention = getMaterializedTeacherGlobalRetention(
  [
    { amount: 3_000, status: "APPLIED", bookingId: null },
    { amount: 1_000, status: "APPLIED", bookingId: "booking-a" },
  ],
  [
    // La séance A peut déjà être PAID et absente des dossiers
    // actuellement payables : sa retenue reste une preuve historique.
    { bookingId: "booking-a", retainedAmount: 4_000 },
  ],
);
assert.equal(
  materializedGlobalRetention,
  3_000,
  "une retenue globale matérialisée sur une ancienne séance ne doit jamais être appliquée une seconde fois",
);
assert.equal(
  getMaterializedTeacherGlobalRetention(
    [{ amount: 3_000, status: "APPLIED", bookingId: null }],
    [],
    [
      { bookingId: "legacy-a", retainedAmountSnapshot: 3_000 },
      { bookingId: "legacy-a", retainedAmountSnapshot: 3_000 },
    ],
  ),
  3_000,
  "plusieurs allocations legacy du même booking utilisent le snapshot maximal sans double comptage",
);
const partialLegacyLedger = getTeacherGlobalRetentionLedger(
  [{ amount: 3_000, status: "APPLIED", bookingId: null }],
  [],
  [{ bookingId: "legacy-partial", retainedAmountSnapshot: 3_000 }],
);
assert.equal(partialLegacyLedger.remaining, 0);
assert.equal(partialLegacyLedger.legacyByBooking.get("legacy-partial"), 3_000);
const legacyGrossRemainingAfterFirstPayout = 10_000 - 4_000;
const legacySecondAndFinalPayout = Math.max(
  0,
  legacyGrossRemainingAfterFirstPayout
    - (partialLegacyLedger.legacyByBooking.get("legacy-partial") ?? 0),
);
assert.equal(
  4_000 + legacySecondAndFinalPayout,
  7_000,
  "un versement partiel legacy conserve la retenue affectée à ce booking jusqu'au solde final",
);
const mixedRetentionEvidence = getTeacherGlobalRetentionLedger(
  [{ amount: 5_000, status: "APPLIED", bookingId: null }],
  [{ bookingId: "mixed-booking", retainedAmount: 3_000 }],
  [{ bookingId: "mixed-booking", retainedAmountSnapshot: 2_000 }],
);
assert.equal(
  mixedRetentionEvidence.materialized,
  5_000,
  "des portions distinctes session puis booking-level s'additionnent sans dépasser l'ajustement global",
);

const adminDashboardSource = readFileSync(
  new URL("../src/app/admin/page.tsx", import.meta.url),
  "utf8",
);
assert.match(
  adminDashboardSource,
  /hasAdminPermission\(user\.adminPermissions,\s*"FINANCE_VIEW"\)/,
  "le dashboard doit calculer explicitement l'autorisation finance",
);
assert.match(
  adminDashboardSource,
  /\{canViewFinance\s*&&\s*<FinancialOverview/,
  "la vue financière ne doit jamais être rendue sans FINANCE_VIEW",
);
assert.match(
  adminDashboardSource,
  /financialBookings\.filter\(hasVerifiedClientPayment\)/,
  "le dashboard financier doit exclure les réservations sous-payées après le filtre Prisma",
);

const paymentsPageSource = readFileSync(
  new URL("../src/app/admin/paiements/page.tsx", import.meta.url),
  "utf8",
);
assert.match(paymentsPageSource, /requireAdmin\("FINANCE_VIEW"\)/);
assert.match(
  paymentsPageSource,
  /db\.transaction\.groupBy\([\s\S]*?_count:\s*\{\s*_all:\s*true\s*\}/,
  "les totaux filtrés doivent couvrir toutes les lignes, pas seulement les 300 affichées",
);
assert.match(
  paymentsPageSource,
  /const transactionCount = filteredStatusTotals\.reduce/,
  "les cartes doivent utiliser l'agrégat complet",
);
assert.match(
  paymentsPageSource,
  /table affiche au maximum les 300 plus récentes/,
  "la limite d'affichage doit être expliquée à l'administrateur",
);

const professorPaymentsPageSource = readFileSync(
  new URL("../src/app/professeur/(espace)/paiements/page.tsx", import.meta.url),
  "utf8",
);
const exhaustiveBookingsQuery = professorPaymentsPageSource.match(
  /db\.booking\.findMany\(\{[\s\S]*?\n\s*\}\),\n\s*db\.teacherPaymentAdjustment\.findMany/,
)?.[0] ?? "";
assert.ok(exhaustiveBookingsQuery, "la requête comptable professeur doit rester identifiable");
assert.doesNotMatch(
  exhaustiveBookingsQuery,
  /\btake\s*:/,
  "les soldes professeur doivent couvrir toutes les réservations vérifiées",
);
assert.match(
  professorPaymentsPageSource,
  /db\.teacherPayoutRecord\.aggregate\(\{[\s\S]*status:\s*"PAID"[\s\S]*_sum:\s*\{\s*transferFeeCoveredByPlatform:\s*true\s*\}/,
  "les frais Jèko couverts doivent être agrégés sur tous les versements payés",
);
assert.match(
  professorPaymentsPageSource,
  /db\.teacherPayoutRequest\.aggregate\(\{[\s\S]*status:\s*"PENDING"[\s\S]*_sum:\s*\{\s*amount:\s*true\s*\}/,
  "le montant déjà demandé doit couvrir toutes les demandes en attente",
);
assert.match(
  professorPaymentsPageSource,
  /const visibleSettlementRows = settlementRows\.slice\(0, 100\)/,
  "seul l'historique visuel peut être limité à 100 lignes",
);
assert.match(
  professorPaymentsPageSource,
  /Les totaux ci-dessus couvrent toutes les périodes/,
  "la différence entre totaux exhaustifs et historique visible doit être expliquée",
);

console.log("OK financial summary: gross/net cash, refunds, penalties, retentions, mixed payouts and provider fees verified.");
