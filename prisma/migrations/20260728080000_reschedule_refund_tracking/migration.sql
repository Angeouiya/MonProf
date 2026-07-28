ALTER TYPE "RescheduleRequestStatus" ADD VALUE 'REFUNDED';

ALTER TABLE "BookingRescheduleRequest"
ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "refundExternalReference" TEXT,
ADD COLUMN "refundTransactionId" TEXT,
ADD COLUMN "refundedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "BookingRescheduleRequest_refundTransactionId_key"
ON "BookingRescheduleRequest"("refundTransactionId");

CREATE UNIQUE INDEX "BookingRescheduleRequest_refundExternalReference_key"
ON "BookingRescheduleRequest"("refundExternalReference");

ALTER TABLE "BookingRescheduleRequest"
ADD CONSTRAINT "BookingRescheduleRequest_refundTransactionId_fkey"
FOREIGN KEY ("refundTransactionId") REFERENCES "Transaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
