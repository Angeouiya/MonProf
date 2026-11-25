-- Additive rollout. No account, original receipt or accepted ledger is rewritten.
CREATE TABLE "ManagedPartner" (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true, "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CHECK (length(name) BETWEEN 2 AND 120 AND phone ~ '^\+225(01|05|07)[0-9]{8}$')
);
CREATE INDEX "ManagedPartner_active_name_id_idx" ON "ManagedPartner"(active,name,id);
ALTER TABLE "ManagedCourseDossier"
  ADD COLUMN "initialTotalPrice" INTEGER,
  ADD COLUMN "clientId" TEXT REFERENCES "User"(id) ON DELETE RESTRICT,
  ADD COLUMN "partnerId" TEXT REFERENCES "ManagedPartner"(id) ON DELETE RESTRICT,
  ADD COLUMN "partnerRateBps" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "ManagedCourseDossier_partner_check" CHECK (
    "partnerRateBps" BETWEEN 0 AND 10000 AND ("partnerId" IS NOT NULL OR "partnerRateBps" = 0)
    AND ("initialTotalPrice" IS NULL OR "initialTotalPrice" > 0)
  );
CREATE INDEX "ManagedCourseDossier_clientId_createdAt_id_idx" ON "ManagedCourseDossier"("clientId","createdAt",id);
CREATE INDEX "ManagedCourseDossier_partnerId_createdAt_id_idx" ON "ManagedCourseDossier"("partnerId","createdAt",id);
ALTER TABLE "ManagedCourseSession" ADD COLUMN "parentConfirmedAt" TIMESTAMP(3), ADD COLUMN "parentConfirmationMethod" TEXT;
ALTER TABLE "ManagedCourseOffer" DROP CONSTRAINT "ManagedCourseOffer_rate_check";
ALTER TABLE "ManagedCourseOffer" ADD CONSTRAINT "ManagedCourseOffer_rate_check" CHECK ("commissionRateBps" BETWEEN 0 AND 10000);
ALTER TABLE "ManagedCourseSession" DROP CONSTRAINT "ManagedCourseSession_rate_check";
ALTER TABLE "ManagedCourseSession" ADD CONSTRAINT "ManagedCourseSession_rate_check" CHECK (
  ("commissionRateBps" IS NULL AND "teacherId" IS NULL) OR ("commissionRateBps" IS NOT NULL AND "commissionRateBps" BETWEEN 0 AND 10000)
);
CREATE TABLE "ManagedPartnerPayment" (
  id TEXT PRIMARY KEY, "partnerId" TEXT NOT NULL REFERENCES "ManagedPartner"(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL, "amountDelta" INTEGER NOT NULL, "reversesId" TEXT UNIQUE REFERENCES "ManagedPartnerPayment"(id) ON DELETE RESTRICT,
  method TEXT NOT NULL, reference TEXT NOT NULL, note TEXT NOT NULL, "actorId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(method,reference),
  CHECK ((kind='PAYMENT' AND "amountDelta" < 0 AND "reversesId" IS NULL) OR (kind='PAYMENT_REVERSAL' AND "amountDelta" > 0 AND "reversesId" IS NOT NULL)),
  CHECK (length(reference) >= 3 AND length(note) >= 10)
);
CREATE INDEX "ManagedPartnerPayment_partnerId_createdAt_id_idx" ON "ManagedPartnerPayment"("partnerId","createdAt",id);
CREATE TRIGGER managed_partner_payments_append_only BEFORE UPDATE OR DELETE ON "ManagedPartnerPayment" FOR EACH ROW EXECUTE FUNCTION "managed_accounting_append_only"();

-- Keep accepted teacher splits and partner budgets consistent even for direct SQL.
CREATE FUNCTION "managed_partner_budget_guard"() RETURNS trigger LANGUAGE plpgsql SET search_path=competence,pg_catalog AS $$
DECLARE budget INTEGER;
BEGIN
  SELECT "partnerRateBps" INTO budget FROM "ManagedCourseDossier" WHERE id=NEW."dossierId";
  IF NEW."commissionRateBps" IS NOT NULL AND NEW."commissionRateBps" < budget THEN
    RAISE EXCEPTION 'Partner share exceeds platform allocation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER managed_offer_partner_budget BEFORE INSERT OR UPDATE ON "ManagedCourseOffer" FOR EACH ROW EXECUTE FUNCTION "managed_partner_budget_guard"();
CREATE TRIGGER managed_session_partner_budget BEFORE INSERT OR UPDATE ON "ManagedCourseSession" FOR EACH ROW EXECUTE FUNCTION "managed_partner_budget_guard"();
CREATE FUNCTION "managed_partner_snapshot_guard"() RETURNS trigger LANGUAGE plpgsql SET search_path=competence,pg_catalog AS $$
BEGIN
  IF OLD."clientId" IS NOT NULL AND NEW."clientId" IS DISTINCT FROM OLD."clientId" THEN
    RAISE EXCEPTION 'Linked parent account cannot be reassigned';
  END IF;
  IF OLD."initialTotalPrice" IS NOT NULL AND NEW."initialTotalPrice" IS DISTINCT FROM OLD."initialTotalPrice" THEN
    RAISE EXCEPTION 'Original quote cannot be rewritten';
  END IF;
  IF NEW."partnerId" IS DISTINCT FROM OLD."partnerId" OR NEW."partnerRateBps" IS DISTINCT FROM OLD."partnerRateBps" THEN
    IF OLD."receivedAmount" > 0 OR EXISTS(SELECT 1 FROM "ManagedCourseSession" WHERE "dossierId"=OLD.id AND ("teacherId" IS NOT NULL OR status <> 'PLANNED'))
      OR EXISTS(SELECT 1 FROM "ManagedCourseOffer" WHERE "dossierId"=OLD.id AND status IN ('OFFERED','ACCEPTED','CANCEL_REQUESTED','PARTIAL_CANCELLED')) THEN
      RAISE EXCEPTION 'Engaged partnership cannot be rewritten';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER managed_partner_snapshot_immutable BEFORE UPDATE ON "ManagedCourseDossier" FOR EACH ROW EXECUTE FUNCTION "managed_partner_snapshot_guard"();
ALTER TABLE "ManagedCourseSession" ADD CONSTRAINT "ManagedCourseSession_parent_confirmation_check" CHECK (
  ("parentConfirmedAt" IS NULL AND "parentConfirmationMethod" IS NULL) OR
  ("parentConfirmedAt" IS NOT NULL AND "parentConfirmationMethod" IS NOT NULL AND "parentConfirmationMethod" IN ('CLIENT_ACCOUNT','PRIVATE_LINK') AND status IN ('DONE','VALIDATED'))
);
CREATE FUNCTION "managed_parent_confirmation_guard"() RETURNS trigger LANGUAGE plpgsql SET search_path=competence,pg_catalog AS $$
BEGIN
  IF OLD."parentConfirmedAt" IS NOT NULL AND (NEW."parentConfirmedAt" IS DISTINCT FROM OLD."parentConfirmedAt" OR NEW."parentConfirmationMethod" IS DISTINCT FROM OLD."parentConfirmationMethod") THEN
    RAISE EXCEPTION 'Parent confirmation cannot be rewritten';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER managed_parent_confirmation_immutable BEFORE UPDATE ON "ManagedCourseSession" FOR EACH ROW EXECUTE FUNCTION "managed_parent_confirmation_guard"();
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ManagedPartner','ManagedPartnerPayment'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',tbl);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',tbl); END IF;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',tbl); END IF;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='competence_runtime') THEN
      EXECUTE format('GRANT SELECT,INSERT ON TABLE %I TO competence_runtime',tbl);
      IF tbl='ManagedPartner' THEN EXECUTE format('GRANT UPDATE ON TABLE %I TO competence_runtime',tbl); END IF;
      EXECUTE format('CREATE POLICY managed_server_only ON %I TO competence_runtime USING (true) WITH CHECK (true)',tbl);
    END IF;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN EXECUTE format('GRANT SELECT,INSERT,UPDATE ON TABLE %I TO service_role',tbl); END IF;
  END LOOP;
END $$;
