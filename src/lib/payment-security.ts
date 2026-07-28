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

type ClientPaymentProofLike = {
  isQuoteOnly?: boolean | null;
  status?: string | null;
  paymentStatus?: string | null;
  totalClientPays?: number | null;
  totalPrice?: number | null;
  paydunyaStatus?: string | null;
  paydunyaVerifiedAt?: Date | string | null;
  paymentProvider?: string | null;
  providerPaymentStatus?: string | null;
  paymentVerifiedAt?: Date | string | null;
  transactions?: TransactionLike[] | null;
};

export const PAYMENT_PROOF_REQUIRED_ERROR =
  "Action bloquée : la réservation n'est pas active tant que le prestataire n'a pas confirmé le paiement par vérification serveur.";
/** @deprecated Conserve la compatibilité des anciens imports PayDunya. */
export const PAYDUNYA_PROOF_REQUIRED_ERROR = PAYMENT_PROOF_REQUIRED_ERROR;

export const OPERATIONAL_BOOKING_STATUSES_REQUIRING_PAYMENT = [
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
/** @deprecated Conserve la compatibilité des anciens imports PayDunya. */
export const OPERATIONAL_BOOKING_STATUSES_REQUIRING_PAYDUNYA = OPERATIONAL_BOOKING_STATUSES_REQUIRING_PAYMENT;

export function getExpectedClientPaymentAmount(booking: ClientPaymentProofLike) {
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

export function hasCompletedPayDunyaProof(booking: ClientPaymentProofLike) {
  return Boolean(booking.paydunyaVerifiedAt)
    && (booking.paydunyaStatus ?? "").trim().toUpperCase() === "COMPLETED";
}

export function hasCompletedJekoProof(booking: ClientPaymentProofLike) {
  return booking.paymentProvider === "JEKO"
    && Boolean(booking.paymentVerifiedAt)
    && (booking.providerPaymentStatus ?? "").trim().toUpperCase() === "SUCCESS";
}

export function hasCompletedClientPaymentProviderProof(booking: ClientPaymentProofLike) {
  return hasCompletedPayDunyaProof(booking) || hasCompletedJekoProof(booking);
}

export function getVerifiedClientPaymentTransaction(booking: ClientPaymentProofLike) {
  const expectedAmount = getExpectedClientPaymentAmount(booking);
  if (expectedAmount <= 0) return null;
  return booking.transactions?.find((transaction) => (
    transaction.type === "CLIENT_PAYMENT"
    && hasVerifiedClientFunds(transaction.status)
    && Math.max(0, transaction.amount ?? 0) === expectedAmount
  )) ?? null;
}

export function hasVerifiedClientPayment(booking: ClientPaymentProofLike) {
  return hasVerifiedClientFunds(booking.paymentStatus)
    && hasCompletedClientPaymentProviderProof(booking)
    && Boolean(getVerifiedClientPaymentTransaction(booking));
}

/** @deprecated Le nom historique vérifie désormais PayDunya ou Jèko. */
export function getVerifiedPayDunyaClientPaymentTransaction(booking: ClientPaymentProofLike) {
  return getVerifiedClientPaymentTransaction(booking);
}

/** @deprecated Le nom historique vérifie désormais PayDunya ou Jèko. */
export function hasVerifiedPayDunyaClientPayment(booking: ClientPaymentProofLike) {
  return hasVerifiedClientPayment(booking);
}

export function isPaymentReadyForCourseProgressWithProof(booking: ClientPaymentProofLike) {
  return isPaymentReadyForCourseProgress(booking.paymentStatus)
    && hasVerifiedClientPayment(booking);
}

export function isOperationalBookingStatus(status?: string | null) {
  return OPERATIONAL_BOOKING_STATUSES_REQUIRING_PAYMENT.includes(
    status as (typeof OPERATIONAL_BOOKING_STATUSES_REQUIRING_PAYMENT)[number],
  );
}

export function requiresVerifiedPaymentForOperationalAction(booking: ClientPaymentProofLike) {
  return !hasVerifiedClientPayment(booking);
}

/** @deprecated Le nom historique vérifie désormais PayDunya ou Jèko. */
export function requiresVerifiedPayDunyaForOperationalAction(booking: ClientPaymentProofLike) {
  return requiresVerifiedPaymentForOperationalAction(booking);
}

const VERIFIED_CLIENT_PAYMENT_BOOKING_FILTER = {
  paymentStatus: { in: VERIFIED_CLIENT_FUND_STATUS_VALUES },
  transactions: {
    some: {
      type: "CLIENT_PAYMENT",
      status: { in: VERIFIED_CLIENT_FUND_STATUS_VALUES },
      amount: { gt: 0 },
    },
  },
  OR: [
    {
      paydunyaStatus: "COMPLETED",
      paydunyaVerifiedAt: { not: null },
    },
    {
      paymentProvider: "JEKO",
      providerPaymentStatus: "SUCCESS",
      paymentVerifiedAt: { not: null },
    },
  ],
} satisfies Prisma.BookingWhereInput;

export function verifiedClientPaymentBookingWhere(where: Prisma.BookingWhereInput = {}): Prisma.BookingWhereInput {
  return {
    AND: [
      where,
      VERIFIED_CLIENT_PAYMENT_BOOKING_FILTER,
    ],
  };
}

/** @deprecated Le nom historique filtre désormais les paiements PayDunya et Jèko. */
export function verifiedPayDunyaBookingWhere(where: Prisma.BookingWhereInput = {}): Prisma.BookingWhereInput {
  return verifiedClientPaymentBookingWhere(where);
}
