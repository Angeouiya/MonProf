export const FINALIZED_BOOKING_REFUND_STATUSES = ["REFUNDED", "PARTIALLY_REFUNDED"] as const;

type BookingRefundAmounts = {
  confirmedClientPaymentAmount: number;
  finalizedRefundAmount: number;
  cancellationRefundAmount: number;
  totalClientPays: number;
  totalPrice: number;
  paymentServiceFeeAmount: number;
  requestAmount: number;
};

export type BookingRefundCalculation = {
  refundAmount: number;
  remainingPolicyRefundAmount: number;
  remainingPaidAmount: number;
  maximumClientRefundableAmount: number;
  totalRefundedAfter: number;
  finalPaymentStatus: "REFUNDED" | "PARTIALLY_REFUNDED";
};

export type BookingRefundPayoutSafetyInput = {
  bookingStatus?: string | null;
  teacherPaidAmount?: number | null;
  cancellationPenaltyTeacherAmount?: number | null;
  activePayoutReferences?: string[];
  sessions?: Array<{ status: string; paidAmount?: number | null }>;
  paidAllocations?: Array<{ bookingSessionId?: string | null; amount?: number | null }>;
};

export type BookingRefundPayoutSafety =
  | { safe: true; allowedCancellationPenaltyPaid: number }
  | { safe: false; code: "TEACHER_PAYOUT_IN_PROGRESS" | "TEACHER_PAYOUT_ALREADY_STARTED"; message: string };

function asMoney(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/**
 * Invariant commun entre le remboursement client et le ledger professeur.
 * Un DRAFT peut déjà avoir été soumis au fournisseur : on ne l'annule donc
 * jamais silencieusement. Une somme de cours déjà versée doit également
 * rester visible et interdit un remboursement général incohérent.
 */
export function evaluateBookingRefundPayoutSafety(
  input: BookingRefundPayoutSafetyInput,
): BookingRefundPayoutSafety {
  if ((input.activePayoutReferences?.length ?? 0) > 0) {
    return {
      safe: false,
      code: "TEACHER_PAYOUT_IN_PROGRESS",
      message: `Un versement professeur est encore en cours (${input.activePayoutReferences!.join(", ")}). Rapprochez ou annulez ce transfert avant le remboursement client.`,
    };
  }

  const sessionPaid = (input.sessions ?? []).some((session) => (
    ["PAID", "PARTIALLY_PAID"].includes(session.status)
    || Math.max(0, session.paidAmount ?? 0) > 0
  ));
  const paidSessionAllocation = (input.paidAllocations ?? []).some((allocation) => (
    Boolean(allocation.bookingSessionId) && Math.max(0, allocation.amount ?? 0) > 0
  ));
  if (sessionPaid || paidSessionAllocation) {
    return {
      safe: false,
      code: "TEACHER_PAYOUT_ALREADY_STARTED",
      message: "Une séance a déjà été payée, même partiellement, au professeur. Le remboursement client doit être arbitré manuellement sans effacer ce versement.",
    };
  }

  const allowedCancellationPenaltyPaid = ["CANCELLED", "REFUNDED"].includes(input.bookingStatus ?? "")
    ? Math.max(0, input.cancellationPenaltyTeacherAmount ?? 0)
    : 0;
  const paidLegacyAllocationAmount = (input.paidAllocations ?? [])
    .filter((allocation) => !allocation.bookingSessionId)
    .reduce((sum, allocation) => sum + Math.max(0, allocation.amount ?? 0), 0);
  const legacyPaidEvidence = Math.max(
    Math.max(0, input.teacherPaidAmount ?? 0),
    paidLegacyAllocationAmount,
  );
  if (legacyPaidEvidence > allowedCancellationPenaltyPaid) {
    return {
      safe: false,
      code: "TEACHER_PAYOUT_ALREADY_STARTED",
      message: "Un versement professeur déjà exécuté dépasse l'indemnité d'annulation prévue. Le remboursement client doit être arbitré manuellement.",
    };
  }

  return { safe: true, allowedCancellationPenaltyPaid };
}

export function buildBookingRefundLedgerReference(refundRequestId: string) {
  const normalizedId = refundRequestId.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  return `TX-REFUND-BOOKING-${normalizedId}`;
}

export function normalizeBookingRefundExternalReference(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s*([-_/])\s*/g, "$1")
    .replace(/\s+/g, " ");
}

/**
 * Calcule uniquement ce qui peut encore sortir de la plateforme : le plus petit
 * solde entre le plafond décidé lors de l'annulation, l'argent client confirmé
 * et le montant demandé. Les remboursements de suppléments de report sont
 * volontairement exclus par l'appelant.
 */
export function calculateRemainingBookingRefund(input: BookingRefundAmounts): BookingRefundCalculation {
  const confirmedClientPaymentAmount = asMoney(input.confirmedClientPaymentAmount);
  const finalizedRefundAmount = asMoney(input.finalizedRefundAmount);
  const paymentServiceFeeAmount = asMoney(input.paymentServiceFeeAmount);
  const totalPaidByClient = asMoney(input.totalClientPays) || asMoney(input.totalPrice);
  const maximumWithoutServiceFee = Math.max(0, totalPaidByClient - paymentServiceFeeAmount);
  const maximumClientRefundableAmount = Math.min(confirmedClientPaymentAmount, maximumWithoutServiceFee);
  const policyRefundAmount = asMoney(input.cancellationRefundAmount) > 0
    ? Math.min(asMoney(input.cancellationRefundAmount), maximumClientRefundableAmount)
    : maximumClientRefundableAmount;
  const remainingPolicyRefundAmount = Math.max(0, policyRefundAmount - finalizedRefundAmount);
  const remainingPaidAmount = Math.max(0, confirmedClientPaymentAmount - finalizedRefundAmount);
  const requestAmount = asMoney(input.requestAmount);
  const refundAmount = Math.min(remainingPolicyRefundAmount, remainingPaidAmount, requestAmount);
  const totalRefundedAfter = finalizedRefundAmount + refundAmount;

  return {
    refundAmount,
    remainingPolicyRefundAmount,
    remainingPaidAmount,
    maximumClientRefundableAmount,
    totalRefundedAfter,
    finalPaymentStatus: totalRefundedAfter >= maximumClientRefundableAmount
      ? "REFUNDED"
      : "PARTIALLY_REFUNDED",
  };
}
