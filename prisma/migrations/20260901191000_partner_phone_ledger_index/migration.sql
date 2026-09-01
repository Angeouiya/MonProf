-- Partner accounting groups use the normalized phone as their stable ledger key.
UPDATE competence."PartnerReferral"
SET "promoterPhone" = regexp_replace("promoterPhone", '[^0-9+]', '', 'g')
WHERE "promoterPhone" IS NOT NULL
  AND "promoterPhone" <> regexp_replace("promoterPhone", '[^0-9+]', '', 'g');

CREATE INDEX IF NOT EXISTS "PartnerReferral_status_promoterPhone_payableAt_idx"
ON competence."PartnerReferral"("status", "promoterPhone", "payableAt");
