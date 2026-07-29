type BookingFinancialState = {
  status?: string | null;
  paymentStatus?: string | null;
  cancellationPenaltyTeacherAmount?: number | null;
};

type BookingSessionPayoutState = BookingFinancialState & {
  sessionStatus?: string | null;
};

const IMMUTABLE_BOOKING_STATUSES = new Set(["REFUNDED", "TEACHER_PAID"]);
const IMMUTABLE_PAYMENT_STATUSES = new Set(["REFUNDED", "TEACHER_PAID"]);
const REFUND_PAYMENT_STATUSES = new Set([
  "REFUND_PENDING",
  "PARTIAL_REFUND_PENDING",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export function isBookingFinanciallyTerminal(booking: BookingFinancialState) {
  return IMMUTABLE_BOOKING_STATUSES.has(booking.status ?? "")
    || IMMUTABLE_PAYMENT_STATUSES.has(booking.paymentStatus ?? "");
}

export function isBookingRefundInProgressOrFinal(booking: BookingFinancialState) {
  return ["CANCELLED", "REFUNDED"].includes(booking.status ?? "")
    || REFUND_PAYMENT_STATUSES.has(booking.paymentStatus ?? "");
}

export function isBookingSessionPayoutEligible(booking: BookingSessionPayoutState) {
  if (["CANCELLED", "REFUNDED"].includes(booking.status ?? "")) return false;
  if (isBookingFinanciallyTerminal(booking) || isBookingRefundInProgressOrFinal(booking)) return false;
  return booking.paymentStatus === "TO_PAY_TEACHER"
    && (booking.sessionStatus === "RELEASED" || booking.sessionStatus === "PARTIALLY_PAID");
}

export function isBookingLevelPayoutEligible(booking: BookingFinancialState) {
  const cancellationPenalty = Math.max(0, booking.cancellationPenaltyTeacherAmount ?? 0);
  if (
    ["CANCELLED", "REFUNDED"].includes(booking.status ?? "")
    && cancellationPenalty > 0
    && ["PARTIALLY_REFUNDED", "RETAINED"].includes(booking.paymentStatus ?? "")
  ) {
    return true;
  }
  return !isBookingFinanciallyTerminal(booking)
    && !isBookingRefundInProgressOrFinal(booking)
    && booking.paymentStatus === "TO_PAY_TEACHER";
}
