SET search_path TO "competence";

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "cancellationPenaltyTeacherRate" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cancellationPenaltyTeacherAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cancellationPenaltyPlatformRate" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cancellationPenaltyPlatformAmount" INTEGER NOT NULL DEFAULT 0;
