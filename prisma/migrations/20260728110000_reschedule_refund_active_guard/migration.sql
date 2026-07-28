-- A paid reschedule rejected by the teacher remains financially active until
-- its supplement is refunded. Refuse the migration instead of silently
-- choosing one request if historical data already violates that invariant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "BookingRescheduleRequest"
    WHERE "status" IN (
      'PAYMENT_PENDING'::"RescheduleRequestStatus",
      'PAYMENT_FAILED'::"RescheduleRequestStatus",
      'AWAITING_TEACHER'::"RescheduleRequestStatus",
      'REFUND_REQUIRED'::"RescheduleRequestStatus"
    )
    GROUP BY "bookingId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate financially active reschedule requests must be resolved before migration';
  END IF;
END $$;

DROP INDEX "BookingRescheduleRequest_one_active_per_booking";

CREATE UNIQUE INDEX "BookingRescheduleRequest_one_active_per_booking"
ON "BookingRescheduleRequest" ("bookingId")
WHERE "status" IN (
  'PAYMENT_PENDING'::"RescheduleRequestStatus",
  'PAYMENT_FAILED'::"RescheduleRequestStatus",
  'AWAITING_TEACHER'::"RescheduleRequestStatus",
  'REFUND_REQUIRED'::"RescheduleRequestStatus"
);
