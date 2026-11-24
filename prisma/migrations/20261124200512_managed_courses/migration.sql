-- CreateTable
CREATE TABLE "ManagedCourseDossier" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "journey" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "courseFormat" "CourseFormat" NOT NULL,
    "commune" TEXT,
    "quartier" TEXT,
    "addressHint" TEXT,
    "objective" TEXT,
    "cadence" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "receivedAmount" INTEGER NOT NULL DEFAULT 0,
    "cancelledAmount" INTEGER NOT NULL DEFAULT 0,
    "onHold" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "termsVersion" TEXT NOT NULL,
    "acceptedRevision" INTEGER,
    "acceptedAt" TIMESTAMP(3),
    "acceptanceEvidence" JSONB,
    "contractTokenHash" TEXT,
    "contractTokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedCourseDossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedCourseOffer" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "commissionRateBps" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFERED',
    "termsVersion" TEXT NOT NULL,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "ManagedCourseOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedCourseSession" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 120,
    "amount" INTEGER NOT NULL,
    "commissionRateBps" INTEGER,
    "fundedAmount" INTEGER NOT NULL DEFAULT 0,
    "creditedTeacherAmount" INTEGER NOT NULL DEFAULT 0,
    "teacherId" TEXT,
    "offerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "completedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,

    CONSTRAINT "ManagedCourseSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedParentReceipt" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'RECEIPT',
    "reversesId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "allocations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedParentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedTeacherLedgerEntry" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "sessionId" TEXT,
    "kind" TEXT NOT NULL,
    "reversesId" TEXT,
    "amountDelta" INTEGER NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "note" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedTeacherLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedCourseEvent" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedCourseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedCourseDossier_reference_key" ON "ManagedCourseDossier"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedCourseDossier_clientKey_key" ON "ManagedCourseDossier"("clientKey");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedCourseDossier_contractTokenHash_key" ON "ManagedCourseDossier"("contractTokenHash");

-- CreateIndex
CREATE INDEX "ManagedCourseDossier_status_createdAt_id_idx" ON "ManagedCourseDossier"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ManagedCourseDossier_phone_createdAt_idx" ON "ManagedCourseDossier"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "ManagedCourseOffer_teacherId_status_offeredAt_idx" ON "ManagedCourseOffer"("teacherId", "status", "offeredAt");

-- CreateIndex
CREATE INDEX "ManagedCourseOffer_dossierId_status_idx" ON "ManagedCourseOffer"("dossierId", "status");

-- CreateIndex
CREATE INDEX "ManagedCourseSession_teacherId_scheduledDate_status_idx" ON "ManagedCourseSession"("teacherId", "scheduledDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedCourseSession_dossierId_sequence_key" ON "ManagedCourseSession"("dossierId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedParentReceipt_idempotencyKey_key" ON "ManagedParentReceipt"("idempotencyKey");
CREATE UNIQUE INDEX "ManagedParentReceipt_reversesId_key" ON "ManagedParentReceipt"("reversesId");

-- CreateIndex
CREATE INDEX "ManagedParentReceipt_dossierId_createdAt_idx" ON "ManagedParentReceipt"("dossierId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedParentReceipt_method_reference_key" ON "ManagedParentReceipt"("method", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedTeacherLedgerEntry_idempotencyKey_key" ON "ManagedTeacherLedgerEntry"("idempotencyKey");
CREATE UNIQUE INDEX "ManagedTeacherLedgerEntry_reversesId_key" ON "ManagedTeacherLedgerEntry"("reversesId");

-- CreateIndex
CREATE INDEX "ManagedTeacherLedgerEntry_teacherId_createdAt_idx" ON "ManagedTeacherLedgerEntry"("teacherId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedTeacherLedgerEntry_kind_method_reference_key" ON "ManagedTeacherLedgerEntry"("kind", "method", "reference");

-- CreateIndex
CREATE INDEX "ManagedCourseEvent_dossierId_createdAt_idx" ON "ManagedCourseEvent"("dossierId", "createdAt");

-- AddForeignKey
ALTER TABLE "ManagedCourseOffer" ADD CONSTRAINT "ManagedCourseOffer_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ManagedCourseDossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedCourseOffer" ADD CONSTRAINT "ManagedCourseOffer_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedCourseSession" ADD CONSTRAINT "ManagedCourseSession_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ManagedCourseDossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedCourseSession" ADD CONSTRAINT "ManagedCourseSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedCourseSession" ADD CONSTRAINT "ManagedCourseSession_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "ManagedCourseOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedParentReceipt" ADD CONSTRAINT "ManagedParentReceipt_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ManagedCourseDossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedTeacherLedgerEntry" ADD CONSTRAINT "ManagedTeacherLedgerEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedTeacherLedgerEntry" ADD CONSTRAINT "ManagedTeacherLedgerEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ManagedCourseSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedCourseEvent" ADD CONSTRAINT "ManagedCourseEvent_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ManagedCourseDossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Financial invariants are checked in PostgreSQL as well as in the service.
ALTER TABLE "ManagedCourseDossier" ADD CONSTRAINT "ManagedCourseDossier_money_check"
  CHECK ("unitPrice" > 0 AND "totalPrice" > 0 AND "receivedAmount" >= 0 AND "receivedAmount" <= "totalPrice" AND "cancelledAmount" BETWEEN 0 AND "totalPrice" AND "revision" > 0);
ALTER TABLE "ManagedCourseSession" ADD CONSTRAINT "ManagedCourseSession_money_check"
  CHECK ("durationMinutes" = 120 AND "amount" > 0 AND "fundedAmount" >= 0 AND "fundedAmount" <= "amount" AND "creditedTeacherAmount" >= 0 AND "creditedTeacherAmount" <= "fundedAmount");
ALTER TABLE "ManagedParentReceipt" ADD CONSTRAINT "ManagedParentReceipt_sign_check" CHECK (
  ("kind" = 'RECEIPT' AND "amount" > 0 AND "reversesId" IS NULL)
  OR ("kind" = 'REFUND' AND "amount" < 0 AND "reversesId" IS NULL AND length("note") >= 10)
  OR ("kind" = 'RECEIPT_REVERSAL' AND "amount" < 0 AND "reversesId" IS NOT NULL AND length("note") >= 10)
);
ALTER TABLE "ManagedTeacherLedgerEntry" ADD CONSTRAINT "ManagedTeacherLedgerEntry_sign_check"
  CHECK (("kind" = 'EARNED' AND "amountDelta" > 0 AND "sessionId" IS NOT NULL)
    OR ("kind" = 'PAYMENT' AND "amountDelta" < 0 AND "reference" IS NOT NULL AND "method" IS NOT NULL)
    OR ("kind" = 'EARNED_REVERSAL' AND "amountDelta" < 0 AND "sessionId" IS NOT NULL)
    OR ("kind" = 'PAYMENT_REVERSAL' AND "amountDelta" > 0 AND "reversesId" IS NOT NULL));
ALTER TABLE "ManagedParentReceipt" ADD CONSTRAINT "ManagedParentReceipt_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "ManagedParentReceipt"("id") ON DELETE RESTRICT;
ALTER TABLE "ManagedTeacherLedgerEntry" ADD CONSTRAINT "ManagedTeacherLedgerEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "ManagedTeacherLedgerEntry"("id") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "ManagedCourseOffer_one_pending_key" ON "ManagedCourseOffer"("dossierId") WHERE "status" = 'OFFERED';
ALTER TABLE "ManagedCourseOffer" ADD CONSTRAINT "ManagedCourseOffer_rate_check" CHECK ("commissionRateBps" BETWEEN 2000 AND 3000 AND "commissionRateBps" % 100 = 0);
ALTER TABLE "ManagedCourseSession" ADD CONSTRAINT "ManagedCourseSession_rate_check" CHECK (
  ("commissionRateBps" IS NULL AND "teacherId" IS NULL)
  OR ("commissionRateBps" BETWEEN 2000 AND 3000 AND "commissionRateBps" % 100 = 0 AND "commissionRateBps" IS NOT NULL)
);

-- The browser and Supabase public API cannot read these guest contracts or
-- accounting records. The dedicated NextAuth server role enforces ownership.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['ManagedCourseDossier','ManagedCourseOffer','ManagedCourseSession','ManagedParentReceipt','ManagedTeacherLedgerEntry','ManagedCourseEvent'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'competence_runtime') THEN
      EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO competence_runtime', table_name);
      IF table_name NOT IN ('ManagedParentReceipt','ManagedTeacherLedgerEntry','ManagedCourseEvent') THEN
        EXECUTE format('GRANT UPDATE ON TABLE %I TO competence_runtime', table_name);
      END IF;
      EXECUTE format('CREATE POLICY managed_server_only ON %I TO competence_runtime USING (true) WITH CHECK (true)', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO service_role', table_name);
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION "managed_accounting_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Managed financial and audit records are append-only';
END;
$$;
CREATE TRIGGER managed_receipts_append_only BEFORE UPDATE OR DELETE ON "ManagedParentReceipt" FOR EACH ROW EXECUTE FUNCTION "managed_accounting_append_only"();
CREATE TRIGGER managed_ledger_append_only BEFORE UPDATE OR DELETE ON "ManagedTeacherLedgerEntry" FOR EACH ROW EXECUTE FUNCTION "managed_accounting_append_only"();
CREATE TRIGGER managed_events_append_only BEFORE UPDATE OR DELETE ON "ManagedCourseEvent" FOR EACH ROW EXECUTE FUNCTION "managed_accounting_append_only"();

CREATE FUNCTION "managed_commission_snapshot_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."commissionRateBps" IS DISTINCT FROM OLD."commissionRateBps" THEN
    IF TG_TABLE_NAME = 'ManagedCourseOffer' THEN
      RAISE EXCEPTION 'An offered commission cannot be changed; create a new offer';
    END IF;
    IF OLD."status" IN ('DONE', 'VALIDATED') OR OLD."creditedTeacherAmount" > 0 THEN
      RAISE EXCEPTION 'An earned commission snapshot cannot be changed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER managed_offer_rate_immutable BEFORE UPDATE ON "ManagedCourseOffer" FOR EACH ROW EXECUTE FUNCTION "managed_commission_snapshot_immutable"();
CREATE TRIGGER managed_session_rate_immutable BEFORE UPDATE ON "ManagedCourseSession" FOR EACH ROW EXECUTE FUNCTION "managed_commission_snapshot_immutable"();

