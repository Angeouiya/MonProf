-- Invalidate JWT sessions deterministically whenever an account password changes.
ALTER TABLE "User"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Teacher"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Professor reset links use the same one-time, one-hour token model as client
-- and administrator accounts.
CREATE TABLE "TeacherPasswordResetToken" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherPasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherPasswordResetToken_tokenHash_key"
ON "TeacherPasswordResetToken"("tokenHash");

CREATE INDEX "TeacherPasswordResetToken_teacherId_expiresAt_idx"
ON "TeacherPasswordResetToken"("teacherId", "expiresAt");

CREATE INDEX "TeacherPasswordResetToken_expiresAt_idx"
ON "TeacherPasswordResetToken"("expiresAt");

ALTER TABLE "TeacherPasswordResetToken"
ADD CONSTRAINT "TeacherPasswordResetToken_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
