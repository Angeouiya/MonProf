export type TeacherPaymentBooking = {
  id?: string;
  status?: string;
  teacherNetAmount: number;
  cancellationPenaltyTeacherAmount?: number | null;
  teacherPaidAmount?: number | null;
  paymentStatus: string;
  sessions?: Array<{
    status: string;
    teacherNetAmount?: number;
    releasedAmount?: number;
    paidAmount?: number;
    retainedAmount?: number;
  }>;
};

function usesSessionLedger(booking: TeacherPaymentBooking) {
  return !["CANCELLED", "REFUNDED"].includes(booking.status ?? "")
    && !isCancellationPenaltyPayout(booking)
    && Boolean(booking.sessions?.length);
}

export type TeacherPaymentAdjustment = {
  amount: number;
  status: string;
  bookingId?: string | null;
};

export type TeacherRetentionEvidence = {
  bookingId: string;
  retainedAmount: number;
};

export type TeacherLegacyRetentionEvidence = {
  bookingId: string;
  retainedAmountSnapshot: number;
};

export type TeacherPayoutSettlementBalance = {
  bookingId: string;
  remaining: number;
  totalOutstanding?: number;
};

export type TeacherPayoutDraftReservation = {
  amount: number;
  payoutRequestStatus?: string | null;
};

export type TeacherGlobalRetentionLedger = ReturnType<typeof getTeacherGlobalRetentionLedger>;

/**
 * Calcule la part déjà consommée des retenues globales sur tout
 * l'historique du professeur, y compris les séances déjà payées.
 *
 * Pour un booking moderne, retainedAmount persiste sur les séances. Pour un
 * ancien booking sans ledger, le meilleur justificatif persistant est le plus
 * grand snapshot d'une allocation DRAFT/PAID. Le résultat conserve aussi
 * l'affectation legacy par booking : elle doit continuer à réduire le reste
 * de ce booking après un premier versement partiel.
 */
export function getTeacherGlobalRetentionLedger(
  adjustments: TeacherPaymentAdjustment[],
  sessionEvidence: TeacherRetentionEvidence[],
  legacyEvidence: TeacherLegacyRetentionEvidence[] = [],
) {
  const globalAdjustmentTotal = adjustments
    .filter((adjustment) => adjustment.status === "APPLIED" && !adjustment.bookingId)
    .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amount), 0);
  const emptyLedger = {
    total: globalAdjustmentTotal,
    materialized: 0,
    remaining: globalAdjustmentTotal,
    sessionByBooking: new Map<string, number>(),
    legacyByBooking: new Map<string, number>(),
  };
  if (globalAdjustmentTotal <= 0) return emptyLedger;

  const bookingSpecific = new Map<string, number>();
  for (const adjustment of adjustments) {
    if (adjustment.status !== "APPLIED" || !adjustment.bookingId) continue;
    bookingSpecific.set(
      adjustment.bookingId,
      (bookingSpecific.get(adjustment.bookingId) ?? 0) + Math.max(0, adjustment.amount),
    );
  }

  const sessionRetained = new Map<string, number>();
  for (const evidence of sessionEvidence) {
    sessionRetained.set(
      evidence.bookingId,
      (sessionRetained.get(evidence.bookingId) ?? 0) + Math.max(0, evidence.retainedAmount),
    );
  }
  const legacyRetained = new Map<string, number>();
  for (const evidence of legacyEvidence) {
    legacyRetained.set(
      evidence.bookingId,
      Math.max(
        legacyRetained.get(evidence.bookingId) ?? 0,
        Math.max(0, evidence.retainedAmountSnapshot),
      ),
    );
  }

  const bookingIds = [...new Set([...sessionRetained.keys(), ...legacyRetained.keys()])].sort();
  const rawSessionGlobal = new Map<string, number>();
  const rawLegacyGlobal = new Map<string, number>();
  for (const bookingId of bookingIds) {
    const specific = bookingSpecific.get(bookingId) ?? 0;
    const sessionTotal = sessionRetained.get(bookingId) ?? 0;
    const legacyTotal = legacyRetained.get(bookingId) ?? 0;
    rawSessionGlobal.set(bookingId, Math.max(0, sessionTotal - specific));
    rawLegacyGlobal.set(bookingId, Math.max(0, legacyTotal - Math.max(0, specific - sessionTotal)));
  }

  // Les retenues de séance sont la preuve la plus forte car elles vivent
  // directement dans le ledger. Le reliquat global peut ensuite être
  // affecté aux snapshots legacy, sans jamais dépasser les ajustements APPLIED.
  let remaining = globalAdjustmentTotal;
  const sessionByBooking = new Map<string, number>();
  const legacyByBooking = new Map<string, number>();
  for (const bookingId of bookingIds) {
    const assigned = Math.min(remaining, rawSessionGlobal.get(bookingId) ?? 0);
    if (assigned > 0) sessionByBooking.set(bookingId, assigned);
    remaining -= assigned;
  }
  for (const bookingId of bookingIds) {
    const assigned = Math.min(remaining, rawLegacyGlobal.get(bookingId) ?? 0);
    if (assigned > 0) legacyByBooking.set(bookingId, assigned);
    remaining -= assigned;
  }
  return {
    total: globalAdjustmentTotal,
    materialized: globalAdjustmentTotal - remaining,
    remaining,
    sessionByBooking,
    legacyByBooking,
  };
}

export function getMaterializedTeacherGlobalRetention(
  adjustments: TeacherPaymentAdjustment[],
  sessionEvidence: TeacherRetentionEvidence[],
  legacyEvidence: TeacherLegacyRetentionEvidence[] = [],
) {
  return getTeacherGlobalRetentionLedger(
    adjustments,
    sessionEvidence,
    legacyEvidence,
  ).materialized;
}

/**
 * Source de vérité commune entre l'API de demande et les dashboards.
 *
 * Une demande PENDING réserve déjà son montant. Lorsqu'elle est reliée à un
 * transfert DRAFT, l'allocation correspondante ne doit donc pas être comptée
 * une seconde fois. Les DRAFT créés directement par un administrateur restent
 * en revanche des réservations à part entière jusqu'au succès ou à l'annulation
 * du transfert Jèko.
 */
export function calculateTeacherPayoutAvailability(input: {
  settlements: TeacherPayoutSettlementBalance[];
  globalRetentionLedger: TeacherGlobalRetentionLedger;
  pendingRequestedAmount?: number | null;
  draftReservations?: TeacherPayoutDraftReservation[];
}) {
  const legacyRetentionAmount = [...input.globalRetentionLedger.legacyByBooking.values()]
    .reduce((sum, amount) => sum + Math.max(0, amount), 0);
  const retentionNotRepresentedInSettlements = legacyRetentionAmount
    + Math.max(0, input.globalRetentionLedger.remaining);
  const readyAfterAssignedLegacyRetentions = input.settlements.reduce((sum, settlement) => (
    sum + Math.max(
      0,
      Math.max(0, settlement.remaining)
        - (input.globalRetentionLedger.legacyByBooking.get(settlement.bookingId) ?? 0),
    )
  ), 0);
  const readyToReceive = Math.max(
    0,
    readyAfterAssignedLegacyRetentions - Math.max(0, input.globalRetentionLedger.remaining),
  );
  const totalOutstanding = Math.max(
    0,
    input.settlements.reduce(
      (sum, settlement) => sum + Math.max(0, settlement.totalOutstanding ?? settlement.remaining),
      0,
    ) - retentionNotRepresentedInSettlements,
  );
  const pendingRequestedAmount = Math.max(0, input.pendingRequestedAmount ?? 0);
  const draftReservedAmount = (input.draftReservations ?? []).reduce((sum, reservation) => (
    reservation.payoutRequestStatus === "PENDING"
      ? sum
      : sum + Math.max(0, reservation.amount)
  ), 0);
  const requestableAmount = Math.max(
    0,
    readyToReceive - pendingRequestedAmount - draftReservedAmount,
  );

  return {
    readyToReceive,
    totalOutstanding,
    pendingRequestedAmount,
    draftReservedAmount,
    requestableAmount,
    retentionNotRepresentedInSettlements,
  };
}

export function getTeacherPayableAmount(booking: TeacherPaymentBooking) {
  const cancellationPenalty = Math.max(0, booking.cancellationPenaltyTeacherAmount ?? 0);
  if (["CANCELLED", "REFUNDED"].includes(booking.status ?? "")) {
    return cancellationPenalty;
  }
  if (usesSessionLedger(booking)) {
    return booking.sessions!.reduce((sum, session) => sum + Math.max(0, session.releasedAmount ?? 0), 0);
  }
  return Math.max(0, booking.teacherNetAmount);
}

export function getTeacherExpectedAmount(booking: TeacherPaymentBooking) {
  if (["CANCELLED", "REFUNDED"].includes(booking.status ?? "")) return getTeacherPayableAmount(booking);
  if (booking.sessions?.length) {
    return booking.sessions.reduce((sum, session) => sum + Math.max(0, session.teacherNetAmount ?? 0), 0);
  }
  return Math.max(0, booking.teacherNetAmount);
}

export function getTeacherBlockedAmount(booking: TeacherPaymentBooking) {
  if (!usesSessionLedger(booking)) {
    return booking.paymentStatus === "BLOCKED" ? getTeacherExpectedAmount(booking) : 0;
  }
  return booking.sessions!.reduce((sum, session) => {
    if (["RELEASED", "PARTIALLY_PAID", "PAID", "CANCELLED", "REFUNDED"].includes(session.status)) return sum;
    return sum + Math.max(0, (session.teacherNetAmount ?? 0) - (session.retainedAmount ?? 0));
  }, 0);
}

export function isCancellationPenaltyPayout(booking: TeacherPaymentBooking) {
  return ["CANCELLED", "REFUNDED"].includes(booking.status ?? "")
    && Math.max(0, booking.cancellationPenaltyTeacherAmount ?? 0) > 0;
}

export function isTeacherPayableStatus(booking: TeacherPaymentBooking) {
  if (["CANCELLED", "REFUNDED"].includes(booking.status ?? "")) {
    return isCancellationPenaltyPayout(booking)
      && ["PARTIALLY_REFUNDED", "RETAINED"].includes(booking.paymentStatus);
  }
  if (usesSessionLedger(booking)) {
    return booking.sessions!.some((session) => (
      ["RELEASED", "PARTIALLY_PAID"].includes(session.status)
      && (session.releasedAmount ?? 0) > (session.paidAmount ?? 0) + (session.retainedAmount ?? 0)
    ));
  }
  if (booking.paymentStatus === "TO_PAY_TEACHER") return true;
  return false;
}

export function getTeacherPaidAmount(booking: TeacherPaymentBooking) {
  const payableAmount = getTeacherPayableAmount(booking);
  if (usesSessionLedger(booking)) {
    return Math.min(
      payableAmount,
      booking.sessions!.reduce((sum, session) => sum + Math.max(0, session.paidAmount ?? 0), 0),
    );
  }
  const explicitPaid = Math.max(0, booking.teacherPaidAmount ?? 0);
  if (explicitPaid > 0) return Math.min(explicitPaid, payableAmount);
  return booking.paymentStatus === "TEACHER_PAID" ? payableAmount : 0;
}

export function getTeacherRetainedAmount(
  booking: TeacherPaymentBooking,
  adjustments: TeacherPaymentAdjustment[] = [],
) {
  if (!booking.id) return 0;
  const adjustmentTotal = adjustments
    .filter((adjustment) => adjustment.status === "APPLIED" && adjustment.bookingId === booking.id)
    .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amount), 0);
  if (usesSessionLedger(booking)) {
    const sessionTotal = booking.sessions!.reduce((sum, session) => sum + Math.max(0, session.retainedAmount ?? 0), 0);
    return Math.max(sessionTotal, adjustmentTotal);
  }
  return adjustmentTotal;
}

export function getTeacherRemainingAmount(
  booking: TeacherPaymentBooking,
  adjustments: TeacherPaymentAdjustment[] = [],
) {
  const payableAmount = getTeacherPayableAmount(booking);
  const retained = getTeacherRetainedAmount(booking, adjustments);
  const paid = usesSessionLedger(booking)
    ? getTeacherPaidAmount(booking)
    : retained > 0 ? Math.max(0, booking.teacherPaidAmount ?? 0) : getTeacherPaidAmount(booking);
  return Math.max(0, payableAmount - paid - retained);
}

export function isTeacherPartiallyPaid(booking: TeacherPaymentBooking) {
  const paid = getTeacherPaidAmount(booking);
  const payableAmount = getTeacherPayableAmount(booking);
  return paid > 0 && paid < payableAmount;
}

export function getTeacherAdjustmentAmount(
  adjustments: TeacherPaymentAdjustment[],
  status: "APPLIED" | "PENDING",
) {
  return adjustments
    .filter((adjustment) => adjustment.status === status)
    .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amount), 0);
}

export function getTeacherAdjustedPayable(
  grossDue: number,
  adjustments: TeacherPaymentAdjustment[],
) {
  const appliedAdjustments = getTeacherAdjustmentAmount(adjustments, "APPLIED");
  return Math.max(0, grossDue - appliedAdjustments);
}

export function getTeacherFinancialSettlement(
  booking: TeacherPaymentBooking,
  adjustments: TeacherPaymentAdjustment[] = [],
) {
  const payableAmount = getTeacherPayableAmount(booking);
  const retained = getTeacherRetainedAmount(booking, adjustments);
  const paid = usesSessionLedger(booking)
    ? getTeacherPaidAmount(booking)
    : retained > 0 ? Math.max(0, booking.teacherPaidAmount ?? 0) : getTeacherPaidAmount(booking);
  const remaining = Math.max(0, payableAmount - paid - retained);
  const expectedAmount = getTeacherExpectedAmount(booking);
  const blocked = getTeacherBlockedAmount(booking);
  return {
    expectedAmount,
    payableAmount,
    released: payableAmount,
    blocked,
    paid,
    retained,
    remaining,
    totalOutstanding: Math.max(0, expectedAmount - paid - retained),
    settled: remaining <= 0,
  };
}
