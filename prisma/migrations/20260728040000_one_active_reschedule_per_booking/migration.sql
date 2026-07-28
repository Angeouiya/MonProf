-- Une tentative marquée PAYMENT_FAILED peut encore être confirmée par le
-- fournisseur. Elle reste donc active et doit être relancée, pas dupliquée.
CREATE UNIQUE INDEX "BookingRescheduleRequest_one_active_per_booking"
ON "BookingRescheduleRequest" ("bookingId")
WHERE "status" IN ('PAYMENT_PENDING', 'PAYMENT_FAILED', 'AWAITING_TEACHER');
