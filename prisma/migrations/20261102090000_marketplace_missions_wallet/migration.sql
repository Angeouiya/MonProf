-- Nouveau modèle de missions ; aucune table de réservation historique n'est modifiée.
CREATE TYPE "MarketplaceRequestStatus" AS ENUM ('SEARCHING', 'OFFERED', 'ACCEPTED', 'IN_PROGRESS', 'AWAITING_CLIENT', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED');
CREATE TYPE "MarketplaceOfferStatus" AS ENUM ('QUEUED', 'PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');
CREATE TYPE "TeacherWalletEntryKind" AS ENUM ('TOPUP', 'RESERVE', 'RELEASE', 'COMMISSION', 'ADJUSTMENT');
CREATE TYPE "TeacherWalletTopUpStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'CANCELLED');

CREATE TABLE "MarketplaceRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientKey" TEXT,
    "assignedTeacherId" TEXT,
    "journey" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "levelName" TEXT NOT NULL,
    "courseFormat" "CourseFormat" NOT NULL,
    "commune" TEXT,
    "quartier" TEXT,
    "addressHint" TEXT,
    "objective" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 120,
    "courseAmount" INTEGER NOT NULL,
    "transportFee" INTEGER NOT NULL DEFAULT 0,
    "totalClientPrice" INTEGER NOT NULL,
    "commissionRateBps" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "status" "MarketplaceRequestStatus" NOT NULL DEFAULT 'SEARCHING',
    "startCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "offerExpiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "teacherEndedAt" TIMESTAMP(3),
    "clientConfirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "disputeReason" TEXT,
    "disputeResolution" TEXT,
    "disputeResolvedAt" TIMESTAMP(3),
    "disputeResolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplaceRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MarketplaceRequest_money_check" CHECK (
      "courseAmount" > 0 AND "transportFee" >= 0
      AND "totalClientPrice" = "courseAmount" + "transportFee"
      AND "commissionRateBps" BETWEEN 0 AND 10000
      AND "commissionAmount" BETWEEN 0 AND "courseAmount"
    )
);

CREATE TABLE "MarketplaceOffer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "transportFee" INTEGER NOT NULL,
    "totalClientPrice" INTEGER NOT NULL,
    "status" "MarketplaceOfferStatus" NOT NULL DEFAULT 'PENDING',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "MarketplaceOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceReview" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MarketplaceReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE TABLE "TeacherWallet" (
    "teacherId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherWallet_pkey" PRIMARY KEY ("teacherId"),
    CONSTRAINT "TeacherWallet_balance_check" CHECK (
      "balance" >= 0 AND "reserved" >= 0 AND "available" >= 0
      AND "available" + "reserved" = "balance"
    )
);

CREATE TABLE "TeacherWalletEntry" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "requestId" TEXT,
    "topUpId" TEXT,
    "kind" "TeacherWalletEntryKind" NOT NULL,
    "balanceDelta" INTEGER NOT NULL DEFAULT 0,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeacherWalletEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherWalletTopUp" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "jekoRequestId" TEXT,
    "jekoStoreId" TEXT,
    "jekoTransactionId" TEXT,
    "checkoutUrl" TEXT,
    "status" "TeacherWalletTopUpStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherWalletTopUp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceRequest_reference_key" ON "MarketplaceRequest"("reference");
CREATE UNIQUE INDEX "MarketplaceRequest_clientId_clientKey_key" ON "MarketplaceRequest"("clientId", "clientKey");
CREATE UNIQUE INDEX "MarketplaceReview_requestId_key" ON "MarketplaceReview"("requestId");
CREATE INDEX "MarketplaceReview_teacherId_published_idx" ON "MarketplaceReview"("teacherId", "published");
CREATE INDEX "MarketplaceRequest_clientId_createdAt_idx" ON "MarketplaceRequest"("clientId", "createdAt");
CREATE INDEX "MarketplaceRequest_assignedTeacherId_status_scheduledDate_idx" ON "MarketplaceRequest"("assignedTeacherId", "status", "scheduledDate");
CREATE INDEX "MarketplaceRequest_status_offerExpiresAt_idx" ON "MarketplaceRequest"("status", "offerExpiresAt");
CREATE INDEX "MarketplaceOffer_teacherId_status_expiresAt_idx" ON "MarketplaceOffer"("teacherId", "status", "expiresAt");
CREATE INDEX "MarketplaceOffer_requestId_rank_idx" ON "MarketplaceOffer"("requestId", "rank");
CREATE UNIQUE INDEX "MarketplaceOffer_requestId_teacherId_key" ON "MarketplaceOffer"("requestId", "teacherId");
CREATE UNIQUE INDEX "MarketplaceOffer_single_pending" ON "MarketplaceOffer"("requestId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "TeacherWalletEntry_topUpId_key" ON "TeacherWalletEntry"("topUpId");
CREATE UNIQUE INDEX "TeacherWalletEntry_idempotencyKey_key" ON "TeacherWalletEntry"("idempotencyKey");
CREATE INDEX "TeacherWalletEntry_teacherId_createdAt_idx" ON "TeacherWalletEntry"("teacherId", "createdAt");
CREATE INDEX "TeacherWalletEntry_requestId_kind_idx" ON "TeacherWalletEntry"("requestId", "kind");
CREATE UNIQUE INDEX "TeacherWalletTopUp_reference_key" ON "TeacherWalletTopUp"("reference");
CREATE UNIQUE INDEX "TeacherWalletTopUp_clientKey_key" ON "TeacherWalletTopUp"("clientKey");
CREATE UNIQUE INDEX "TeacherWalletTopUp_jekoRequestId_key" ON "TeacherWalletTopUp"("jekoRequestId");
CREATE UNIQUE INDEX "TeacherWalletTopUp_jekoTransactionId_key" ON "TeacherWalletTopUp"("jekoTransactionId");
CREATE INDEX "TeacherWalletTopUp_teacherId_status_createdAt_idx" ON "TeacherWalletTopUp"("teacherId", "status", "createdAt");
CREATE INDEX "TeacherWalletTopUp_status_lastCheckedAt_createdAt_idx" ON "TeacherWalletTopUp"("status", "lastCheckedAt", "createdAt");

ALTER TABLE "MarketplaceRequest" ADD CONSTRAINT "MarketplaceRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceRequest" ADD CONSTRAINT "MarketplaceRequest_assignedTeacherId_fkey" FOREIGN KEY ("assignedTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOffer" ADD CONSTRAINT "MarketplaceOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MarketplaceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOffer" ADD CONSTRAINT "MarketplaceOffer_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MarketplaceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherWallet" ADD CONSTRAINT "TeacherWallet_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherWalletEntry" ADD CONSTRAINT "TeacherWalletEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherWalletEntry" ADD CONSTRAINT "TeacherWalletEntry_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MarketplaceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeacherWalletEntry" ADD CONSTRAINT "TeacherWalletEntry_topUpId_fkey" FOREIGN KEY ("topUpId") REFERENCES "TeacherWalletTopUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeacherWalletTopUp" ADD CONSTRAINT "TeacherWalletTopUp_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
