ALTER TYPE "GroupType" ADD VALUE IF NOT EXISTS 'LARGE_GROUP';

ALTER TABLE "ClientReward"
ADD COLUMN IF NOT EXISTS "unlockPaymentNumber" INTEGER;

UPDATE "ClientReward" AS reward
SET "unlockPaymentNumber" = ((purchase."cycle" - 1) * 7) + purchase."sequence"
FROM "ClientLoyaltyPurchase" AS purchase
WHERE purchase."bookingId" = reward."unlockedByBookingId"
  AND reward."unlockPaymentNumber" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ClientReward_unlock_payment_number_positive'
      AND conrelid = '"ClientReward"'::regclass
  ) THEN
    ALTER TABLE "ClientReward"
    ADD CONSTRAINT "ClientReward_unlock_payment_number_positive"
    CHECK ("unlockPaymentNumber" IS NULL OR "unlockPaymentNumber" >= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ClientReward_clientId_unlockedAt_idx"
ON "ClientReward"("clientId", "unlockedAt");

INSERT INTO "Setting" ("id", "key", "value")
VALUES
  ('loyalty-2-gap-payments', 'loyalty_gift_2_gap_payments', '1'),
  ('loyalty-3-gap-payments', 'loyalty_gift_3_gap_payments', '2'),
  ('loyalty-4-gap-payments', 'loyalty_gift_4_gap_payments', '3'),
  ('loyalty-5-gap-payments', 'loyalty_gift_5_gap_payments', '1'),
  ('loyalty-6-gap-payments', 'loyalty_gift_6_gap_payments', '2'),
  ('loyalty-7-gap-payments', 'loyalty_gift_7_gap_payments', '3')
ON CONFLICT ("key") DO NOTHING;
