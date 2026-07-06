export type TeacherPaymentBooking = {
  id?: string;
  status?: string;
  teacherNetAmount: number;
  cancellationPenaltyTeacherAmount?: number | null;
  teacherPaidAmount?: number | null;
  paymentStatus: string;
};

export type TeacherPaymentAdjustment = {
  amount: number;
  status: string;
  bookingId?: string | null;
};

export function getTeacherPayableAmount(booking: TeacherPaymentBooking) {
  const cancellationPenalty = Math.max(0, booking.cancellationPenaltyTeacherAmount ?? 0);
  if (["CANCELLED", "REFUNDED"].includes(booking.status ?? "") && cancellationPenalty > 0) {
    return cancellationPenalty;
  }
  return Math.max(0, booking.teacherNetAmount);
}

export function isCancellationPenaltyPayout(booking: TeacherPaymentBooking) {
  return ["CANCELLED", "REFUNDED"].includes(booking.status ?? "")
    && Math.max(0, booking.cancellationPenaltyTeacherAmount ?? 0) > 0;
}

export function isTeacherPayableStatus(booking: TeacherPaymentBooking) {
  if (booking.paymentStatus === "TO_PAY_TEACHER") return true;
  return isCancellationPenaltyPayout(booking)
    && ["PARTIALLY_REFUNDED", "RETAINED"].includes(booking.paymentStatus);
}

export function getTeacherPaidAmount(booking: TeacherPaymentBooking) {
  const payableAmount = getTeacherPayableAmount(booking);
  const explicitPaid = Math.max(0, booking.teacherPaidAmount ?? 0);
  if (explicitPaid > 0) return Math.min(explicitPaid, payableAmount);
  return booking.paymentStatus === "TEACHER_PAID" ? payableAmount : 0;
}

export function getTeacherRetainedAmount(
  booking: TeacherPaymentBooking,
  adjustments: TeacherPaymentAdjustment[] = [],
) {
  if (!booking.id) return 0;
  return adjustments
    .filter((adjustment) => adjustment.status === "APPLIED" && adjustment.bookingId === booking.id)
    .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amount), 0);
}

export function getTeacherRemainingAmount(
  booking: TeacherPaymentBooking,
  adjustments: TeacherPaymentAdjustment[] = [],
) {
  const payableAmount = getTeacherPayableAmount(booking);
  const retained = getTeacherRetainedAmount(booking, adjustments);
  const paid = retained > 0 ? Math.max(0, booking.teacherPaidAmount ?? 0) : getTeacherPaidAmount(booking);
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
  const paid = retained > 0 ? Math.max(0, booking.teacherPaidAmount ?? 0) : getTeacherPaidAmount(booking);
  const remaining = Math.max(0, payableAmount - paid - retained);
  return {
    payableAmount,
    paid,
    retained,
    remaining,
    settled: remaining <= 0,
  };
}
