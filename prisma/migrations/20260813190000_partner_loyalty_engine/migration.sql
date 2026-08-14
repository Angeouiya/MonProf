-- Partenariat permanent par client + programme Cadeaux.
CREATE TYPE "PartnerProfileStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "PartnerAttributionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "ClientRewardStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'USED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "PartnerProfile" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "promoterName" TEXT NOT NULL,
  "promoterPhone" TEXT NOT NULL,
  "promoterEmail" TEXT,
  "status" "PartnerProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientPartnerAttribution" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "partnerProfileId" TEXT NOT NULL,
  "sourceCode" TEXT NOT NULL,
  "status" "PartnerAttributionStatus" NOT NULL DEFAULT 'PENDING',
  "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "firstBookingId" TEXT,
  "initialDiscountBookingId" TEXT,
  "initialDiscountUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientPartnerAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientLoyaltyPurchase" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "cycle" INTEGER NOT NULL DEFAULT 1,
  "qualifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMP(3),
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientLoyaltyPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientReward" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "unlockedByBookingId" TEXT NOT NULL,
  "usedBookingId" TEXT,
  "cycle" INTEGER NOT NULL DEFAULT 1,
  "milestone" INTEGER NOT NULL,
  "discountRate" INTEGER NOT NULL,
  "validityDays" INTEGER NOT NULL,
  "status" "ClientRewardStatus" NOT NULL DEFAULT 'AVAILABLE',
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "reservedAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientReward_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Booking"
  ADD COLUMN "partnerAttributionId" TEXT,
  ADD COLUMN "partnerDiscountRate" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "partnerDiscountAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rewardDiscountRate" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rewardDiscountAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "partnerCommissionAmount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PartnerReferral"
  ADD COLUMN "eligibleCourseAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clientDiscountAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "partnerProfileId" TEXT,
  ADD COLUMN "attributionId" TEXT;

CREATE UNIQUE INDEX "PartnerProfile_code_key" ON "PartnerProfile"("code");
CREATE UNIQUE INDEX "PartnerProfile_promoterPhone_key" ON "PartnerProfile"("promoterPhone");
CREATE INDEX "PartnerProfile_status_createdAt_idx" ON "PartnerProfile"("status", "createdAt");
CREATE UNIQUE INDEX "ClientPartnerAttribution_clientId_key" ON "ClientPartnerAttribution"("clientId");
CREATE UNIQUE INDEX "ClientPartnerAttribution_initialDiscountBookingId_key" ON "ClientPartnerAttribution"("initialDiscountBookingId");
CREATE INDEX "ClientPartnerAttribution_partnerProfileId_status_endsAt_idx" ON "ClientPartnerAttribution"("partnerProfileId", "status", "endsAt");
CREATE INDEX "ClientPartnerAttribution_status_endsAt_idx" ON "ClientPartnerAttribution"("status", "endsAt");
CREATE UNIQUE INDEX "ClientLoyaltyPurchase_bookingId_key" ON "ClientLoyaltyPurchase"("bookingId");
CREATE INDEX "ClientLoyaltyPurchase_clientId_qualifiedAt_idx" ON "ClientLoyaltyPurchase"("clientId", "qualifiedAt");
CREATE INDEX "ClientLoyaltyPurchase_clientId_reversedAt_qualifiedAt_idx" ON "ClientLoyaltyPurchase"("clientId", "reversedAt", "qualifiedAt");
CREATE UNIQUE INDEX "ClientReward_unlockedByBookingId_key" ON "ClientReward"("unlockedByBookingId");
CREATE UNIQUE INDEX "ClientReward_usedBookingId_key" ON "ClientReward"("usedBookingId");
CREATE INDEX "ClientReward_clientId_status_expiresAt_idx" ON "ClientReward"("clientId", "status", "expiresAt");
CREATE INDEX "PartnerReferral_partnerProfileId_status_idx" ON "PartnerReferral"("partnerProfileId", "status");
CREATE INDEX "PartnerReferral_attributionId_declaredAt_idx" ON "PartnerReferral"("attributionId", "declaredAt");

ALTER TABLE "ClientPartnerAttribution" ADD CONSTRAINT "ClientPartnerAttribution_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPartnerAttribution" ADD CONSTRAINT "ClientPartnerAttribution_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientLoyaltyPurchase" ADD CONSTRAINT "ClientLoyaltyPurchase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientLoyaltyPurchase" ADD CONSTRAINT "ClientLoyaltyPurchase_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientReward" ADD CONSTRAINT "ClientReward_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientReward" ADD CONSTRAINT "ClientReward_unlockedByBookingId_fkey" FOREIGN KEY ("unlockedByBookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientReward" ADD CONSTRAINT "ClientReward_usedBookingId_fkey" FOREIGN KEY ("usedBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerAttributionId_fkey" FOREIGN KEY ("partnerAttributionId") REFERENCES "ClientPartnerAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "ClientPartnerAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Les réglages restent modifiables sans migration via la table Setting.
INSERT INTO "Setting" ("id", "key", "value") VALUES
  ('loyalty-enabled-default', 'loyalty_gifts_enabled', 'true'),
  ('loyalty-cycle-default', 'loyalty_gifts_cycle_enabled', 'false'),
  ('loyalty-floor-default', 'loyalty_minimum_margin_percent', '5'),
  ('loyalty-steps-default', 'loyalty_gift_steps_json', '[{"milestone":2,"discountRate":12,"validityDays":9},{"milestone":3,"discountRate":9,"validityDays":7},{"milestone":4,"discountRate":10,"validityDays":12},{"milestone":5,"discountRate":13,"validityDays":10},{"milestone":6,"discountRate":8,"validityDays":8},{"milestone":7,"discountRate":15,"validityDays":7}]'),
  ('loyalty-2-rate', 'loyalty_gift_2_rate', '12'), ('loyalty-2-days', 'loyalty_gift_2_days', '9'),
  ('loyalty-3-rate', 'loyalty_gift_3_rate', '9'), ('loyalty-3-days', 'loyalty_gift_3_days', '7'),
  ('loyalty-4-rate', 'loyalty_gift_4_rate', '10'), ('loyalty-4-days', 'loyalty_gift_4_days', '12'),
  ('loyalty-5-rate', 'loyalty_gift_5_rate', '13'), ('loyalty-5-days', 'loyalty_gift_5_days', '10'),
  ('loyalty-6-rate', 'loyalty_gift_6_rate', '8'), ('loyalty-6-days', 'loyalty_gift_6_days', '8'),
  ('loyalty-7-rate', 'loyalty_gift_7_rate', '15'), ('loyalty-7-days', 'loyalty_gift_7_days', '7')
ON CONFLICT ("key") DO NOTHING;
