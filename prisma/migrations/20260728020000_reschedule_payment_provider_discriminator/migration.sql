-- Null keeps historical records on the legacy PayDunya/manual path. New Jèko
-- requests always persist the provider before an external checkout is created.
ALTER TABLE "BookingRescheduleRequest"
ADD COLUMN "paymentProvider" "PaymentProvider";

CREATE INDEX "BookingRescheduleRequest_paymentProvider_status_idx"
ON "BookingRescheduleRequest"("paymentProvider", "status");
