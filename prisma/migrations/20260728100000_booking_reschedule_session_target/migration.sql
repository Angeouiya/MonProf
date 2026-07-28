-- Bind every new reschedule request to the exact session selected by the
-- client. The nullable column keeps historical booking-level requests valid.
ALTER TABLE "BookingRescheduleRequest"
ADD COLUMN "bookingSessionId" TEXT;

CREATE INDEX "BookingRescheduleRequest_bookingSessionId_idx"
ON "BookingRescheduleRequest"("bookingSessionId");

ALTER TABLE "BookingRescheduleRequest"
ADD CONSTRAINT "BookingRescheduleRequest_bookingSessionId_fkey"
FOREIGN KEY ("bookingSessionId") REFERENCES "BookingSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
