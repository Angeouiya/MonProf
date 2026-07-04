import type { Prisma } from "@prisma/client";

export const COURSE_PROGRESS_PAYMENT_STATUSES = ["RECEIVED", "BLOCKED", "VALIDATED"] as const;

export const VERIFIED_CLIENT_FUND_STATUSES = [
  "RECEIVED",
  "BLOCKED",
  "VALIDATED",
  "TO_PAY_TEACHER",
  "TEACHER_PAID",
  "DISPUTED",
  "REFUND_PENDING",
  "PARTIAL_REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "RETAINED",
] as const;

export const VERIFIED_CLIENT_FUND_STATUS_VALUES = [...VERIFIED_CLIENT_FUND_STATUSES];

export const REFUNDABLE_CLIENT_FUND_STATUSES = [
  "RECEIVED",
  "BLOCKED",
  "VALIDATED",
  "TO_PAY_TEACHER",
  "DISPUTED",
  "REFUND_PENDING",
  "PARTIAL_REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "RETAINED",
] as const;

type TransactionLike = {
  type?: string | null;
  status?: string | null;
  amount?: number | null;
};

type PayDunyaPaymentProofLike = {
  isQuoteOnly?: boolean | null;
  status?: string | null;
  paymentStatus?: string | null;
  totalClientPays?: number | null;
  totalPrice?: number | null;
  paydunyaStatus?: string | null;
  paydunyaVerifiedAt?: Date | string | null;
  transactions?: TransactionLike[] | null;
};

export const PAYDUNYA_PROOF_REQUIRED_ERROR =
  "Action bloquée: la réservation n'est pas active tant que PayDunya n'a pas confirmé le paiement via vérification serveur.";

export const OPERATIONAL_BOOKING_STATUSES_REQUIRING_PAYDUNYA = [
  "PAID",
  "PENDING_ADMIN_VALIDATION",
  "CONFIRMED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COURSE_DONE",
  "PENDING_CLIENT_VALIDATION",
  "VALIDATED_BY_CLIENT",
  "PAYMENT_TO_RELEASE",
  "TEACHER_PAID",
  "DISPUTED",
] as const;

export function getExpectedClientPaymentAmount(booking: PayDunyaPaymentProofLike) {
  const totalClientPays = Math.max(0, booking.totalClientPays ?? 0);
  const totalPrice = Math.max(0, booking.totalPrice ?? 0);
  return totalClientPays > 0 ? totalClientPays : totalPrice;
}

export function isPaymentReadyForCourseProgress(status?: string | null) {
  return COURSE_PROGRESS_PAYMENT_STATUSES.includes(status as (typeof COURSE_PROGRESS_PAYMENT_STATUSES)[number]);
}

export function hasVerifiedClientFunds(status?: string | null) {
  return VERIFIED_CLIENT_FUND_STATUSES.includes(status as (typeof VERIFIED_CLIENT_FUND_STATUSES)[number]);
}

export function hasRefundableClientFunds(status?: string | null) {
  return REFUNDABLE_CLIENT_FUND_STATUSES.includes(status as (typeof REFUNDABLE_CLIENT_FUND_STATUSES)[number]);
}

export function hasVerifiedClientPaymentTransaction(transactions: TransactionLike[] | undefined | null) {
  return Boolean(transactions?.some((transaction) => (
    transaction.type === "CLIENT_PAYMENT"
    && Math.max(0, transaction.amount ?? 0) > 0
    && hasVerifiedClientFunds(transaction.status)
  )));
}

export function hasCompletedPayDunyaProof(booking: PayDunyaPaymentProofLike) {
  return Boolean(booking.paydunyaVerifiedAt)
    && (booking.paydunyaStatus ?? "").trim().toUpperCase() === "COMPLETED";
}

export function getVerifiedPayDunyaClientPaymentTransaction(booking: PayDunyaPaymentProofLike) {
  const expectedAmount = getExpectedClientPaymentAmount(booking);
  if (expectedAmount <= 0) return null;
  return booking.transactions?.find((transaction) => (
    transaction.type === "CLIENT_PAYMENT"
    && hasVerifiedClientFunds(transaction.status)
    && Math.max(0, transaction.amount ?? 0) === expectedAmount
  )) ?? null;
}

export function hasVerifiedPayDunyaClientPayment(booking: PayDunyaPaymentProofLike) {
  return hasVerifiedClientFunds(booking.paymentStatus)
    && hasCompletedPayDunyaProof(booking)
    && Boolean(getVerifiedPayDunyaClientPaymentTransaction(booking));
}

export function isPaymentReadyForCourseProgressWithProof(booking: PayDunyaPaymentProofLike) {
  return isPaymentReadyForCourseProgress(booking.paymentStatus)
    && hasVerifiedPayDunyaClientPayment(booking);
}

export function isOperationalBookingStatus(status?: string | null) {
  return OPERATIONAL_BOOKING_STATUSES_REQUIRING_PAYDUNYA.includes(
    status as (typeof OPERATIONAL_BOOKING_STATUSES_REQUIRING_PAYDUNYA)[number],
  );
}

export function requiresVerifiedPayDunyaForOperationalAction(booking: PayDunyaPaymentProofLike) {
  return !hasVerifiedPayDunyaClientPayment(booking);
}

const VERIFIED_PAYDUNYA_BOOKING_FILTER = {
  paymentStatus: { in: VERIFIED_CLIENT_FUND_STATUS_VALUES },
  paydunyaStatus: "COMPLETED",
  paydunyaVerifiedAt: { not: null },
  transactions: {
    some: {
      type: "CLIENT_PAYMENT",
      status: { in: VERIFIED_CLIENT_FUND_STATUS_VALUES },
      amount: { gt: 0 },
    },
  },
} satisfies Prisma.BookingWhereInput;

export function verifiedPayDunyaBookingWhere(where: Prisma.BookingWhereInput = {}): Prisma.BookingWhereInput {
  return {
    AND: [
      where,
      VERIFIED_PAYDUNYA_BOOKING_FILTER,
    ],
  };
}
