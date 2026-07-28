-- Persist every provider attempt and webhook/API verification independently of
-- the historical PayDunya columns kept on Booking for backwards compatibility.
CREATE TYPE "PaymentAttemptPurpose" AS ENUM ('BOOKING', 'RESCHEDULE_FEE');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'REQUESTING', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REJECTED');
CREATE TYPE "PaymentEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED', 'FAILED');
CREATE TYPE "PaymentVerificationSource" AS ENUM ('WEBHOOK', 'SERVER_CONFIRMATION');

ALTER TABLE "Booking"
ADD COLUMN "clientCreationKey" TEXT,
ADD COLUMN "paymentProvider" "PaymentProvider",
ADD COLUMN "paymentVerifiedAt" TIMESTAMP(3),
ADD COLUMN "providerPaymentStatus" TEXT;

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "purpose" "PaymentAttemptPurpose" NOT NULL DEFAULT 'BOOKING',
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "bookingId" TEXT,
    "rescheduleRequestId" TEXT,
    "transactionId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerToken" TEXT,
    "checkoutUrl" TEXT,
    "storeId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "amountXof" INTEGER NOT NULL,
    "providerAmountMinor" INTEGER NOT NULL,
    "courseAmountXof" INTEGER NOT NULL DEFAULT 0,
    "transportAmountXof" INTEGER NOT NULL DEFAULT 0,
    "serviceFeeAmountXof" INTEGER NOT NULL DEFAULT 0,
    "commissionAmountXof" INTEGER NOT NULL DEFAULT 0,
    "teacherAmountXof" INTEGER NOT NULL DEFAULT 0,
    "providerFeeAmountXof" INTEGER NOT NULL DEFAULT 0,
    "providerFeeAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "method" "PaymentMethod",
    "failureCode" TEXT,
    "failureReason" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "requestedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "paymentAttemptId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "PaymentEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "verificationSource" "PaymentVerificationSource" NOT NULL DEFAULT 'WEBHOOK',
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "providerOrderId" TEXT,
    "reference" TEXT,
    "storeId" TEXT,
    "currency" TEXT,
    "amountXof" INTEGER,
    "providerAmountMinor" INTEGER,
    "providerFeeAmountXof" INTEGER,
    "providerFeeAmountMinor" INTEGER,
    "payloadSha256" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processingError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentAttempt_transactionId_key" ON "PaymentAttempt"("transactionId");
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentAttempt_reference_key" ON "PaymentAttempt"("reference");
CREATE UNIQUE INDEX "PaymentAttempt_providerOrderId_key" ON "PaymentAttempt"("providerOrderId");
CREATE UNIQUE INDEX "PaymentAttempt_providerToken_key" ON "PaymentAttempt"("providerToken");
CREATE INDEX "PaymentAttempt_bookingId_provider_status_idx" ON "PaymentAttempt"("bookingId", "provider", "status");
CREATE INDEX "PaymentAttempt_rescheduleRequestId_provider_status_idx" ON "PaymentAttempt"("rescheduleRequestId", "provider", "status");
CREATE INDEX "PaymentAttempt_provider_status_createdAt_idx" ON "PaymentAttempt"("provider", "status", "createdAt");
CREATE INDEX "PaymentAttempt_storeId_provider_createdAt_idx" ON "PaymentAttempt"("storeId", "provider", "createdAt");

CREATE UNIQUE INDEX "PaymentEvent_dedupeKey_key" ON "PaymentEvent"("dedupeKey");
CREATE INDEX "PaymentEvent_paymentAttemptId_receivedAt_idx" ON "PaymentEvent"("paymentAttemptId", "receivedAt");
CREATE INDEX "PaymentEvent_provider_providerEventId_idx" ON "PaymentEvent"("provider", "providerEventId");
CREATE INDEX "PaymentEvent_provider_status_receivedAt_idx" ON "PaymentEvent"("provider", "status", "receivedAt");

CREATE UNIQUE INDEX "Booking_clientCreationKey_key" ON "Booking"("clientCreationKey");
CREATE INDEX "Booking_paymentProvider_providerPaymentStatus_paymentVerifi_idx"
ON "Booking"("paymentProvider", "providerPaymentStatus", "paymentVerifiedAt");

ALTER TABLE "PaymentAttempt"
ADD CONSTRAINT "PaymentAttempt_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAttempt"
ADD CONSTRAINT "PaymentAttempt_rescheduleRequestId_fkey"
FOREIGN KEY ("rescheduleRequestId") REFERENCES "BookingRescheduleRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAttempt"
ADD CONSTRAINT "PaymentAttempt_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentEvent"
ADD CONSTRAINT "PaymentEvent_paymentAttemptId_fkey"
FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
