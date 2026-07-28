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

function asMoney(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function buildBookingRefundLedgerReference(refundRequestId: string) {
  const normalizedId = refundRequestId.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  return `TX-REFUND-BOOKING-${normalizedId}`;
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
