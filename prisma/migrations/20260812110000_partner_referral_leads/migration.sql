-- Pré-déclarations apporteurs : un apporteur peut créer un lien mobile
-- avant que le client ne réserve. La commission reste créée uniquement
-- au moment de la réservation payée et validée.

CREATE TYPE "PartnerReferralLeadStatus" AS ENUM ('DECLARED', 'MATCHED', 'EXPIRED', 'REJECTED');

CREATE TABLE "PartnerReferralLead" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "promoterName" TEXT NOT NULL,
  "promoterPhone" TEXT NOT NULL,
  "promoterEmail" TEXT,
  "expectedClientName" TEXT,
  "expectedClientPhone" TEXT,
  "requestedJourney" TEXT,
  "message" TEXT,
  "promotionStartsAt" TIMESTAMP(3) NOT NULL,
  "promotionEndsAt" TIMESTAMP(3) NOT NULL,
  "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "PartnerReferralLeadStatus" NOT NULL DEFAULT 'DECLARED',
  "matchedBookingId" TEXT,
  "convertedReferralId" TEXT,
  "matchedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerReferralLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerReferralLead_code_key" ON "PartnerReferralLead"("code");
CREATE INDEX "PartnerReferralLead_status_promotionEndsAt_idx" ON "PartnerReferralLead"("status", "promotionEndsAt");
CREATE INDEX "PartnerReferralLead_promoterPhone_declaredAt_idx" ON "PartnerReferralLead"("promoterPhone", "declaredAt");
CREATE INDEX "PartnerReferralLead_expectedClientPhone_declaredAt_idx" ON "PartnerReferralLead"("expectedClientPhone", "declaredAt");
CREATE INDEX "PartnerReferralLead_code_idx" ON "PartnerReferralLead"("code");
