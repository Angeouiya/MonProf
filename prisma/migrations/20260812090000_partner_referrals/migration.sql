-- CreateEnum
CREATE TYPE "PartnerReferralStatus" AS ENUM ('DECLARED', 'PAYMENT_CONFIRMED', 'PAYABLE', 'PAID', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "PartnerReferral" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "teacherId" TEXT,
    "promoterName" TEXT NOT NULL,
    "promoterPhone" TEXT,
    "promotionCode" TEXT,
    "promotionStartsAt" TIMESTAMP(3) NOT NULL,
    "promotionEndsAt" TIMESTAMP(3) NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PartnerReferralStatus" NOT NULL DEFAULT 'DECLARED',
    "courseAmount" INTEGER NOT NULL,
    "commissionRate" INTEGER NOT NULL DEFAULT 10,
    "commissionAmount" INTEGER NOT NULL,
    "paymentConfirmedAt" TIMESTAMP(3),
    "bookingConfirmedAt" TIMESTAMP(3),
    "payableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "payoutMethod" "PaymentMethod",
    "payoutPhone" TEXT,
    "payoutReference" TEXT,
    "promoterIdentityName" TEXT,
    "promoterIdentityVerifiedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerReferral_bookingId_key" ON "PartnerReferral"("bookingId");

-- CreateIndex
CREATE INDEX "PartnerReferral_status_promotionEndsAt_idx" ON "PartnerReferral"("status", "promotionEndsAt");

-- CreateIndex
CREATE INDEX "PartnerReferral_clientId_declaredAt_idx" ON "PartnerReferral"("clientId", "declaredAt");

-- CreateIndex
CREATE INDEX "PartnerReferral_teacherId_declaredAt_idx" ON "PartnerReferral"("teacherId", "declaredAt");

-- CreateIndex
CREATE INDEX "PartnerReferral_promoterName_idx" ON "PartnerReferral"("promoterName");

-- CreateIndex
CREATE INDEX "PartnerReferral_promoterPhone_idx" ON "PartnerReferral"("promoterPhone");

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
