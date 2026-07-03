export const REVIEWABLE_BOOKING_STATUSES = [
  "VALIDATED_BY_CLIENT",
  "PAYMENT_TO_RELEASE",
  "TEACHER_PAID",
] as const;

export function isReviewableBookingStatus(status: string) {
  return REVIEWABLE_BOOKING_STATUSES.includes(status as (typeof REVIEWABLE_BOOKING_STATUSES)[number]);
}
