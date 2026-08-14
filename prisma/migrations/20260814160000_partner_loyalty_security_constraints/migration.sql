-- Defense in depth for partner commissions and loyalty gifts.
-- NOT VALID keeps the release safe if a historical row needs an audit while
-- PostgreSQL still enforces every constraint for new or modified rows.

ALTER TABLE "ClientLoyaltyPurchase"
  ADD CONSTRAINT "ClientLoyaltyPurchase_sequence_range"
  CHECK ("sequence" BETWEEN 1 AND 7 AND "cycle" >= 1) NOT VALID;

ALTER TABLE "ClientReward"
  ADD CONSTRAINT "ClientReward_program_ranges"
  CHECK (
    "milestone" BETWEEN 2 AND 7
    AND "discountRate" BETWEEN 8 AND 15
    AND "validityDays" BETWEEN 7 AND 14
    AND "cycle" >= 1
    AND "expiresAt" > "unlockedAt"
  ) NOT VALID;

ALTER TABLE "ClientReward"
  ADD CONSTRAINT "ClientReward_used_state_complete"
  CHECK (
    "status" <> 'USED'
    OR ("usedBookingId" IS NOT NULL AND "usedAt" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "ClientPartnerAttribution"
  ADD CONSTRAINT "ClientPartnerAttribution_active_window_complete"
  CHECK (
    "status" <> 'ACTIVE'
    OR ("startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" > "startsAt")
  ) NOT VALID;

ALTER TABLE "PartnerReferral"
  ADD CONSTRAINT "PartnerReferral_financial_ranges"
  CHECK (
    "courseAmount" >= 0
    AND "eligibleCourseAmount" >= 0
    AND "clientDiscountAmount" >= 0
    AND "commissionRate" BETWEEN 0 AND 10
    AND "commissionAmount" >= 0
    AND "commissionAmount" <= "eligibleCourseAmount"
  ) NOT VALID;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_partner_reward_ranges"
  CHECK (
    "partnerDiscountRate" BETWEEN 0 AND 10
    AND "rewardDiscountRate" BETWEEN 0 AND 15
    AND "partnerDiscountAmount" >= 0
    AND "rewardDiscountAmount" >= 0
    AND "partnerCommissionAmount" >= 0
  ) NOT VALID;
