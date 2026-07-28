-- Preserve Jèko transfer fees in provider minor units. Existing XOF columns
-- remain the compatibility source for historical rows created before this
-- migration.
ALTER TABLE "TeacherPayoutRecord"
ADD COLUMN "transferFeeAmountMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "transferFeeCoveredByPlatformMinor" INTEGER NOT NULL DEFAULT 0;
