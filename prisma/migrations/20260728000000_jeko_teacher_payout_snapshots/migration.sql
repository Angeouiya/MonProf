-- Introduce the provider discriminator used by Jèko collections and payouts.
CREATE TYPE "PaymentProvider" AS ENUM ('PAYDUNYA', 'JEKO');

-- Jèko supports Djamo in addition to the historical mobile-money methods.
ALTER TYPE "PaymentMethod" ADD VALUE 'DJAMO';

-- A payout record now starts pending, stores the immutable provider reference,
-- and separates the exact teacher net from fees covered by Compétence.
ALTER TABLE "TeacherPayoutRecord"
ADD COLUMN "provider" "PaymentProvider",
ADD COLUMN "providerReference" TEXT,
ADD COLUMN "transferFeeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "transferFeeCoveredByPlatform" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "paidAt" DROP NOT NULL,
ALTER COLUMN "paidAt" DROP DEFAULT;

-- Freeze the accounting state allocated to each payout so a retry can never
-- pay more than the amount that was reserved for the professor.
ALTER TABLE "TeacherPayoutAllocation"
ADD COLUMN "paidAmountBefore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "releasedAmountSnapshot" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "retainedAmountSnapshot" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "TeacherPayoutRecord_providerReference_key"
ON "TeacherPayoutRecord"("providerReference");

CREATE INDEX "TeacherPayoutRecord_provider_status_paidAt_idx"
ON "TeacherPayoutRecord"("provider", "status", "paidAt");
