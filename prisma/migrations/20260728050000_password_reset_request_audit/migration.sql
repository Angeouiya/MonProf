-- Pseudonymised request log used to apply the same throttling path whether or
-- not an account exists. Raw email addresses and IP addresses are never stored.
ALTER TABLE "PasswordResetToken"
ADD COLUMN "deliveredAt" TIMESTAMP(3);

ALTER TABLE "TeacherPasswordResetToken"
ADD COLUMN "deliveredAt" TIMESTAMP(3);

-- Preserve reset links that were already issued before deliveredAt existed.
UPDATE "PasswordResetToken"
SET "deliveredAt" = "createdAt"
WHERE "deliveredAt" IS NULL
  AND "usedAt" IS NULL
  AND "expiresAt" > CURRENT_TIMESTAMP;

UPDATE "TeacherPasswordResetToken"
SET "deliveredAt" = "createdAt"
WHERE "deliveredAt" IS NULL
  AND "usedAt" IS NULL
  AND "expiresAt" > CURRENT_TIMESTAMP;

CREATE TABLE "PasswordResetRequestAudit" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "accountHash" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetRequestAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordResetRequestAudit_ipHash_createdAt_idx"
ON "PasswordResetRequestAudit"("ipHash", "createdAt");

CREATE INDEX "PasswordResetRequestAudit_accountHash_createdAt_idx"
ON "PasswordResetRequestAudit"("accountHash", "createdAt");

CREATE INDEX "PasswordResetRequestAudit_createdAt_idx"
ON "PasswordResetRequestAudit"("createdAt");

-- Durable security-email outbox. Sensitive data is encrypted by the app with
-- AES-256-GCM; only pseudonymous routing hashes remain queryable.
CREATE TABLE "PasswordEmailOutbox" (
    "id" TEXT NOT NULL,
    "requestAuditId" TEXT,
    "kind" TEXT NOT NULL,
    "accountHash" TEXT NOT NULL,
    "routingHash" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payloadCiphertext" TEXT,
    "payloadIv" TEXT,
    "payloadAuthTag" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "ambiguousAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "lastError" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordEmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordEmailOutbox_requestAuditId_key"
ON "PasswordEmailOutbox"("requestAuditId");

CREATE UNIQUE INDEX "PasswordEmailOutbox_dedupeKey_key"
ON "PasswordEmailOutbox"("dedupeKey");

CREATE INDEX "PasswordEmailOutbox_status_availableAt_idx"
ON "PasswordEmailOutbox"("status", "availableAt");

CREATE INDEX "PasswordEmailOutbox_accountHash_status_createdAt_idx"
ON "PasswordEmailOutbox"("accountHash", "status", "createdAt");

CREATE INDEX "PasswordEmailOutbox_routingHash_status_idx"
ON "PasswordEmailOutbox"("routingHash", "status");

CREATE INDEX "PasswordEmailOutbox_expiresAt_idx"
ON "PasswordEmailOutbox"("expiresAt");

-- One reset request per logical account route can be active at a time. A
-- repeated browser request therefore wakes the same durable job and reuses the
-- exact same token/link instead of racing a second email.
CREATE UNIQUE INDEX "PasswordEmailOutbox_active_reset_routing_key"
ON "PasswordEmailOutbox"("routingHash")
WHERE "kind" = 'PASSWORD_RESET'
  AND "status" IN ('PENDING', 'RETRY', 'PROCESSING');

-- Claims for the same pseudonymous account are serialized across workers.
CREATE UNIQUE INDEX "PasswordEmailOutbox_processing_account_key"
ON "PasswordEmailOutbox"("accountHash")
WHERE "status" = 'PROCESSING';

ALTER TABLE "PasswordEmailOutbox"
ADD CONSTRAINT "PasswordEmailOutbox_requestAuditId_fkey"
FOREIGN KEY ("requestAuditId") REFERENCES "PasswordResetRequestAudit"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
