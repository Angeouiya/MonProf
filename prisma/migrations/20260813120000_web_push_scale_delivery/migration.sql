-- Web Push scale delivery audit and device metadata.

-- CreateEnum
CREATE TYPE "WebPushDeliveryStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'ACCEPTED',
  'FAILED',
  'EXPIRED',
  'REVOKED'
);

-- AlterTable
ALTER TABLE "WebPushSubscription"
  ADD COLUMN "deviceId" TEXT,
  ADD COLUMN "platform" TEXT,
  ADD COLUMN "browser" TEXT,
  ADD COLUMN "os" TEXT,
  ADD COLUMN "pwaInstalled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supportsVibration" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supportsBadging" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WebPushDelivery" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "outboxId" UUID NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "status" "WebPushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "providerStatusCode" INTEGER,
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebPushDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebPushSubscription_deviceId_idx" ON "WebPushSubscription"("deviceId");
CREATE INDEX "WebPushSubscription_platform_enabled_idx" ON "WebPushSubscription"("platform", "enabled");
CREATE UNIQUE INDEX "WebPushDelivery_outboxId_subscriptionId_key" ON "WebPushDelivery"("outboxId", "subscriptionId");
CREATE INDEX "WebPushDelivery_outboxId_status_idx" ON "WebPushDelivery"("outboxId", "status");
CREATE INDEX "WebPushDelivery_subscriptionId_status_idx" ON "WebPushDelivery"("subscriptionId", "status");
CREATE INDEX "WebPushDelivery_status_updatedAt_idx" ON "WebPushDelivery"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "WebPushDelivery"
  ADD CONSTRAINT "WebPushDelivery_outboxId_fkey"
  FOREIGN KEY ("outboxId") REFERENCES "WebPushOutbox"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebPushDelivery"
  ADD CONSTRAINT "WebPushDelivery_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "WebPushSubscription"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
