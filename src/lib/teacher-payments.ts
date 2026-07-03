export type TeacherPaymentBooking = {
  id?: string;
  teacherNetAmount: number;
  teacherPaidAmount?: number | null;
  paymentStatus: string;
};

export type TeacherPaymentAdjustment = {
  amount: number;
  status: string;
  bookingId?: string | null;
};

export function getTeacherPaidAmount(booking: TeacherPaymentBooking) {
  const explicitPaid = Math.max(0, booking.teacherPaidAmount ?? 0);
  if (explicitPaid > 0) return Math.min(explicitPaid, booking.teacherNetAmount);
  return booking.paymentStatus === "TEACHER_PAID" ? booking.teacherNetAmount : 0;
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
  const retained = getTeacherRetainedAmount(booking, adjustments);
  const paid = retained > 0 ? Math.max(0, booking.teacherPaidAmount ?? 0) : getTeacherPaidAmount(booking);
  return Math.max(0, booking.teacherNetAmount - paid - retained);
}

export function isTeacherPartiallyPaid(booking: TeacherPaymentBooking) {
  const paid = getTeacherPaidAmount(booking);
  return paid > 0 && paid < booking.teacherNetAmount;
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
  const retained = getTeacherRetainedAmount(booking, adjustments);
  const paid = retained > 0 ? Math.max(0, booking.teacherPaidAmount ?? 0) : getTeacherPaidAmount(booking);
  const remaining = Math.max(0, booking.teacherNetAmount - paid - retained);
  return {
    paid,
    retained,
    remaining,
    settled: remaining <= 0,
  };
}
