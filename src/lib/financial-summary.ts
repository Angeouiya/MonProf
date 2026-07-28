export type FinancialRescheduleLine = {
  totalToPay?: number | null;
  feeAmount?: number | null;
  paymentServiceFeeAmount?: number | null;
  feePlatformAmount?: number | null;
  feeTeacherAmount?: number | null;
  providerFeeAmountXof?: number | null;
  providerFeeAmountMinor?: number | null;
  /** Part historique sans source mineure exacte. */
  providerFeeLegacyAmountXof?: number | null;
  status?: string | null;
  transactionStatus?: string | null;
  paidAt?: Date | string | null;
};

export type FinancialBookingLine = {
  totalClientPays?: number | null;
  courseAmount?: number | null;
  transportFee?: number | null;
  paymentServiceFeeAmount?: number | null;
  commissionAmount?: number | null;
  teacherNetAmount?: number | null;
  teacherPaidAmount?: number | null;
  status?: string | null;
  cancellationPenaltyTeacherAmount?: number | null;
  cancellationPenaltyPlatformAmount?: number | null;
  reschedules?: FinancialRescheduleLine[] | null;
  /** Sum of confirmed payout allocations attached to this booking. */
  paidPayoutAllocationAmount?: number | null;
  /** Sum of every successful BOOKING collection attempt for this booking. */
  providerFeeAmountXof?: number | null;
  /** Sum of exact Jèko minor units for successful BOOKING attempts. */
  providerFeeAmountMinor?: number | null;
  /** Historical provider fees that only exist as already-rounded XOF. */
  providerFeeLegacyAmountXof?: number | null;
  refunds?: FinancialRefundLine[] | null;
};

export type FinancialRefundLine = {
  amount?: number | null;
  status?: string | null;
};

export type FinancialTeacherAdjustmentLine = {
  amount?: number | null;
  status?: string | null;
};

export type FinancialPayoutLine = {
  amount?: number | null;
  transferFeeCoveredByPlatform?: number | null;
  transferFeeCoveredByPlatformMinor?: number | null;
  status?: "DRAFT" | "PAID" | "CANCELLED" | null;
};

export type PlatformFinancialSummary = {
  clientGross: number;
  refundsPaid: number;
  clientNetCollected: number;
  baseClientGross: number;
  rescheduleGross: number;
  courseRevenue: number;
  transportCollected: number;
  rescheduleFeesCollected: number;
  serviceFeesCollected: number;
  rescheduleServiceFees: number;
  providerCollectionFees: number;
  rescheduleProviderFees: number;
  commissionRevenue: number;
  rescheduleCommissionRevenue: number;
  teacherNetGenerated: number;
  rescheduleTeacherNetGenerated: number;
  cancellationTeacherNetGenerated: number;
  teacherPaid: number;
  teacherRetained: number;
  teacherRemaining: number;
  teacherOverpaid: number;
  transferFeesCovered: number;
  serviceFeesRemaining: number;
};

const EARNING_RESCHEDULE_TRANSACTION_STATUSES = new Set([
  "RECEIVED",
  "BLOCKED",
  "VALIDATED",
  "TO_PAY_TEACHER",
  "TEACHER_PAID",
  "RETAINED",
]);

function money(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

type ProviderFeeSource = {
  providerFeeAmountXof?: number | null;
  providerFeeAmountMinor?: number | null;
};

export type ProviderFeeAggregate = {
  providerFeeAmountMinor: number;
  providerFeeLegacyAmountXof: number;
};

/**
 * Cumule les unités mineures avant conversion. Les anciennes lignes, migrées
 * avec minor=0 mais un montant XOF positif, restent comptées via le fallback
 * XOF sans inventer une précision qui n'existait pas à leur création.
 */
export function aggregateProviderFeeAmounts(
  attempts: ProviderFeeSource[] | null | undefined,
): ProviderFeeAggregate {
  return (attempts ?? []).reduce<ProviderFeeAggregate>((sum, attempt) => {
    const minor = Math.max(0, money(attempt.providerFeeAmountMinor));
    const xof = Math.max(0, money(attempt.providerFeeAmountXof));
    if (minor > 0) {
      sum.providerFeeAmountMinor += minor;
    } else if (xof > 0) {
      sum.providerFeeLegacyAmountXof += xof;
    }
    return sum;
  }, { providerFeeAmountMinor: 0, providerFeeLegacyAmountXof: 0 });
}

export function minorUnitsToCoveredXof(minorAmount: number | null | undefined) {
  return Math.ceil(Math.max(0, money(minorAmount)) / 100);
}

export function sumProviderFeeAmounts(
  attempts: ProviderFeeSource[] | null | undefined,
) {
  const aggregate = aggregateProviderFeeAmounts(attempts);
  return aggregate.providerFeeLegacyAmountXof
    + minorUnitsToCoveredXof(aggregate.providerFeeAmountMinor);
}

/** Champs à transporter jusqu'au récapitulatif global sans arrondi intermédiaire. */
export function providerFeeFinancialFields(
  attempts: ProviderFeeSource[] | null | undefined,
) {
  const aggregate = aggregateProviderFeeAmounts(attempts);
  return {
    ...aggregate,
    providerFeeAmountXof: aggregate.providerFeeLegacyAmountXof
      + minorUnitsToCoveredXof(aggregate.providerFeeAmountMinor),
  };
}

function financialProviderFeeAggregate(
  line: ProviderFeeSource & { providerFeeLegacyAmountXof?: number | null },
) {
  if (line.providerFeeLegacyAmountXof != null) {
    return {
      providerFeeAmountMinor: Math.max(0, money(line.providerFeeAmountMinor)),
      providerFeeLegacyAmountXof: Math.max(0, money(line.providerFeeLegacyAmountXof)),
    };
  }
  return aggregateProviderFeeAmounts([line]);
}

function isPaidReschedule(line: FinancialRescheduleLine) {
  return Boolean(line.paidAt);
}

function isEarningReschedule(line: FinancialRescheduleLine) {
  return isPaidReschedule(line)
    && EARNING_RESCHEDULE_TRANSACTION_STATUSES.has(line.transactionStatus?.trim().toUpperCase() ?? "");
}

function isCompletedRescheduleRefund(line: FinancialRescheduleLine) {
  return line.transactionStatus?.trim().toUpperCase() === "REFUNDED";
}

function isCancelledBooking(booking: FinancialBookingLine) {
  return ["CANCELLED", "REFUNDED"].includes(booking.status?.trim().toUpperCase() ?? "");
}

function isCompletedRefund(line: FinancialRefundLine) {
  return ["REFUNDED", "PARTIALLY_REFUNDED"].includes(line.status?.trim().toUpperCase() ?? "");
}

/**
 * Agrège les lignes financières sans mélanger les revenus Compétence et
 * les frais techniques du prestataire. Les suppléments restent visibles à
 * part, puis rejoignent chaque total consolidé exactement une fois.
 */
export function buildPlatformFinancialSummary(
  bookings: FinancialBookingLine[],
  payouts: FinancialPayoutLine[] = [],
  teacherAdjustments: FinancialTeacherAdjustmentLine[] = [],
): PlatformFinancialSummary {
  const bookingTotals = bookings.reduce((summary, booking) => {
    const paidReschedules = (booking.reschedules ?? []).filter(isPaidReschedule);
    const earningReschedules = paidReschedules.filter(isEarningReschedule);
    // A pending refund is still only an operational intent: the 3% remains
    // collected until the source transaction is atomically finalized as
    // REFUNDED. At that point the full supplement refund already reduces the
    // client net through `refundsPaid`; exclude only its service-fee component
    // here so the same cash refund is never subtracted twice.
    const serviceFeeBearingReschedules = paidReschedules.filter(
      (line) => !isCompletedRescheduleRefund(line),
    );
    const appliedReschedules = paidReschedules.filter((line) => line.status === "APPLIED");

    const appliedCommission = appliedReschedules.reduce(
      (sum, line) => sum + Math.max(0, money(line.feePlatformAmount)),
      0,
    );
    const appliedTeacherNet = appliedReschedules.reduce(
      (sum, line) => sum + Math.max(0, money(line.feeTeacherAmount)),
      0,
    );
    const rescheduleGross = paidReschedules.reduce((sum, line) => sum + money(line.totalToPay), 0);
    const rescheduleFees = paidReschedules.reduce((sum, line) => sum + money(line.feeAmount), 0);
    const rescheduleServiceFees = serviceFeeBearingReschedules.reduce(
      (sum, line) => sum + money(line.paymentServiceFeeAmount),
      0,
    );
    const rescheduleProviderFees = paidReschedules.reduce((sum, line) => {
      const fees = financialProviderFeeAggregate(line);
      sum.minor += fees.providerFeeAmountMinor;
      sum.legacyXof += fees.providerFeeLegacyAmountXof;
      return sum;
    }, { minor: 0, legacyXof: 0 });
    const earnedRescheduleCommission = earningReschedules.reduce(
      (sum, line) => sum + money(line.feePlatformAmount),
      0,
    );
    const cancelledBooking = isCancelledBooking(booking);
    const cancellationPenalty = cancelledBooking
      ? Math.max(0, money(booking.cancellationPenaltyTeacherAmount))
      : 0;
    const rescheduleTeacherNet = cancelledBooking
      ? 0
      : earningReschedules.reduce((sum, line) => sum + money(line.feeTeacherAmount), 0);

    // APPLIED supplements are already folded into these two Booking columns.
    // Remove them first, then add every earning supplement once below. Once a
    // booking is cancelled/refunded, the only platform commission still earned
    // is the cancellation split persisted by the cancellation policy.
    const baseCommission = cancelledBooking
      ? Math.max(0, money(booking.cancellationPenaltyPlatformAmount))
      : Math.max(0, money(booking.commissionAmount) - appliedCommission);
    const rescheduleCommission = cancelledBooking ? 0 : earnedRescheduleCommission;
    const baseTeacherNet = cancelledBooking
      ? cancellationPenalty
      : Math.max(0, money(booking.teacherNetAmount) - appliedTeacherNet);
    const refundsPaid = (booking.refunds ?? [])
      .filter(isCompletedRefund)
      .reduce((sum, refund) => sum + Math.max(0, money(refund.amount)), 0);

    summary.baseClientGross += money(booking.totalClientPays);
    summary.rescheduleGross += rescheduleGross;
    summary.courseRevenue += money(booking.courseAmount);
    summary.transportCollected += money(booking.transportFee);
    summary.rescheduleFeesCollected += rescheduleFees;
    summary.baseServiceFees += money(booking.paymentServiceFeeAmount);
    summary.rescheduleServiceFees += rescheduleServiceFees;
    const baseProviderFees = financialProviderFeeAggregate(booking);
    summary.baseProviderFeeMinor += baseProviderFees.providerFeeAmountMinor;
    summary.baseProviderFeeLegacyXof += baseProviderFees.providerFeeLegacyAmountXof;
    summary.rescheduleProviderFeeMinor += rescheduleProviderFees.minor;
    summary.rescheduleProviderFeeLegacyXof += rescheduleProviderFees.legacyXof;
    summary.baseCommissionRevenue += baseCommission;
    summary.rescheduleCommissionRevenue += rescheduleCommission;
    summary.baseTeacherNetGenerated += baseTeacherNet;
    summary.rescheduleTeacherNetGenerated += rescheduleTeacherNet;
    summary.cancellationTeacherNetGenerated += cancellationPenalty;
    summary.refundsPaid += refundsPaid;

    // A booking may contain both historical paid evidence and modern payout
    // allocations. Keep only the historical residual; the allocated portion is
    // counted from the payout register below. This supports partial migrations
    // without counting the same transfer twice.
    const bookingPaidEvidence = Math.max(0, money(booking.teacherPaidAmount));
    summary.legacyTeacherPaid += Math.max(
      0,
      bookingPaidEvidence - Math.max(0, money(booking.paidPayoutAllocationAmount)),
    );
    return summary;
  }, {
    baseClientGross: 0,
    rescheduleGross: 0,
    courseRevenue: 0,
    transportCollected: 0,
    rescheduleFeesCollected: 0,
    baseServiceFees: 0,
    rescheduleServiceFees: 0,
    baseProviderFeeMinor: 0,
    baseProviderFeeLegacyXof: 0,
    rescheduleProviderFeeMinor: 0,
    rescheduleProviderFeeLegacyXof: 0,
    baseCommissionRevenue: 0,
    rescheduleCommissionRevenue: 0,
    baseTeacherNetGenerated: 0,
    rescheduleTeacherNetGenerated: 0,
    cancellationTeacherNetGenerated: 0,
    legacyTeacherPaid: 0,
    refundsPaid: 0,
  });

  const payoutTotals = payouts.reduce((summary, payout) => {
    // Only a confirmed payout reduces the teacher balance. A failed/cancelled
    // provider transfer can nevertheless leave a real fee paid by Compétence.
    const status = payout.status?.trim().toUpperCase();
    if (!status || status === "PAID") {
      summary.teacherPaid += Math.max(0, money(payout.amount));
    }
    if (!status || status === "PAID" || status === "CANCELLED") {
      const feeMinor = Math.max(0, money(payout.transferFeeCoveredByPlatformMinor));
      const feeXof = Math.max(0, money(payout.transferFeeCoveredByPlatform));
      if (feeMinor > 0) {
        summary.transferFeeMinor += feeMinor;
      } else if (feeXof > 0) {
        summary.transferFeeLegacyXof += feeXof;
      }
    }
    return summary;
  }, { teacherPaid: 0, transferFeeMinor: 0, transferFeeLegacyXof: 0 });

  payoutTotals.teacherPaid += bookingTotals.legacyTeacherPaid;
  const transferFeesCovered = payoutTotals.transferFeeLegacyXof
    + minorUnitsToCoveredXof(payoutTotals.transferFeeMinor);

  const teacherRetained = teacherAdjustments
    .filter((adjustment) => !adjustment.status || adjustment.status.trim().toUpperCase() === "APPLIED")
    .reduce((sum, adjustment) => sum + Math.max(0, money(adjustment.amount)), 0);

  const clientGross = bookingTotals.baseClientGross + bookingTotals.rescheduleGross;
  const clientNetCollected = clientGross - bookingTotals.refundsPaid;
  const serviceFeesCollected = bookingTotals.baseServiceFees + bookingTotals.rescheduleServiceFees;
  const providerCollectionFees = bookingTotals.baseProviderFeeLegacyXof
    + bookingTotals.rescheduleProviderFeeLegacyXof
    + minorUnitsToCoveredXof(
      bookingTotals.baseProviderFeeMinor + bookingTotals.rescheduleProviderFeeMinor,
    );
  const rescheduleProviderFees = bookingTotals.rescheduleProviderFeeLegacyXof
    + minorUnitsToCoveredXof(bookingTotals.rescheduleProviderFeeMinor);
  const commissionRevenue = bookingTotals.baseCommissionRevenue + bookingTotals.rescheduleCommissionRevenue;
  const teacherNetGenerated = bookingTotals.baseTeacherNetGenerated + bookingTotals.rescheduleTeacherNetGenerated;
  const teacherBalance = teacherNetGenerated - payoutTotals.teacherPaid - teacherRetained;

  return {
    clientGross,
    refundsPaid: bookingTotals.refundsPaid,
    clientNetCollected,
    baseClientGross: bookingTotals.baseClientGross,
    rescheduleGross: bookingTotals.rescheduleGross,
    courseRevenue: bookingTotals.courseRevenue,
    transportCollected: bookingTotals.transportCollected,
    rescheduleFeesCollected: bookingTotals.rescheduleFeesCollected,
    serviceFeesCollected,
    rescheduleServiceFees: bookingTotals.rescheduleServiceFees,
    providerCollectionFees,
    rescheduleProviderFees,
    commissionRevenue,
    rescheduleCommissionRevenue: bookingTotals.rescheduleCommissionRevenue,
    teacherNetGenerated,
    rescheduleTeacherNetGenerated: bookingTotals.rescheduleTeacherNetGenerated,
    cancellationTeacherNetGenerated: bookingTotals.cancellationTeacherNetGenerated,
    teacherPaid: payoutTotals.teacherPaid,
    transferFeesCovered,
    teacherRetained,
    teacherRemaining: Math.max(0, teacherBalance),
    teacherOverpaid: Math.max(0, -teacherBalance),
    serviceFeesRemaining: serviceFeesCollected
      - providerCollectionFees
      - transferFeesCovered,
  };
}
