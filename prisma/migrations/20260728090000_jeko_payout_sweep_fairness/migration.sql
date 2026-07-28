-- Record each reconciliation claim so an old pending payout cannot monopolize
-- every sweep batch. The composite index supports the Jèko DRAFT due queue.
ALTER TABLE "TeacherPayoutRecord"
ADD COLUMN "lastCheckedAt" TIMESTAMP(3);

CREATE INDEX "TeacherPayoutRecord_jeko_sweep_idx"
ON "TeacherPayoutRecord"("provider", "status", "lastCheckedAt", "createdAt");

CREATE INDEX "PaymentAttempt_jeko_sweep_idx"
ON "PaymentAttempt"("provider", "purpose", "status", "lastCheckedAt", "updatedAt");

-- The queue predicates and ORDER BY use COALESCE. Plain multicolumn indexes
-- above remain useful for general status lookups, while these partial
-- expression indexes let PostgreSQL stop after the oldest due rows instead of
-- sorting the whole Jèko queue on every cron run.
CREATE INDEX "TeacherPayoutRecord_jeko_sweep_due_expr_idx"
ON "TeacherPayoutRecord"((COALESCE("lastCheckedAt", "createdAt")), "createdAt", "id")
WHERE "provider" = 'JEKO'::"PaymentProvider"
  AND "status" = 'DRAFT'::"TeacherPayoutRecordStatus";

CREATE INDEX "PaymentAttempt_jeko_sweep_due_expr_idx"
ON "PaymentAttempt"((COALESCE("lastCheckedAt", "updatedAt")), "createdAt", "id")
WHERE "provider" = 'JEKO'::"PaymentProvider"
  AND "purpose" IN ('BOOKING'::"PaymentAttemptPurpose", 'RESCHEDULE_FEE'::"PaymentAttemptPurpose")
  AND (
    "status" = 'REQUESTING'::"PaymentAttemptStatus"
    OR (
      "status" = 'PENDING'::"PaymentAttemptStatus"
      AND "providerOrderId" IS NOT NULL
    )
    OR (
      "status" = 'FAILED'::"PaymentAttemptStatus"
      AND "providerOrderId" IS NOT NULL
      AND "failureCode" IS DISTINCT FROM 'JEKO_PAYMENT_FAILED'
    )
  );
