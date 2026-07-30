-- Client accounts may use either an email address or a canonical phone number.
-- Existing duplicate phone values remain display-only: only a normalization
-- that is unique across the current table is promoted to a login identifier.
ALTER TABLE "User"
ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "User"
ADD COLUMN "phoneNormalized" TEXT,
ADD COLUMN "passwordMustChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "temporaryPasswordIssuedAt" TIMESTAMP(3);

WITH raw_phone AS (
  SELECT
    "id",
    regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g') AS digits
  FROM "User"
), without_international_prefix AS (
  SELECT
    "id",
    CASE
      WHEN digits LIKE '00%' THEN substring(digits FROM 3)
      ELSE digits
    END AS digits
  FROM raw_phone
), with_country_prefix AS (
  SELECT
    "id",
    CASE
      WHEN digits NOT LIKE '225%' AND length(digits) = 10
        THEN '225' || digits
      ELSE digits
    END AS digits
  FROM without_international_prefix
), canonical_phone AS (
  SELECT
    "id",
    CASE
      WHEN digits = ''
        OR length(digits) < 8
        OR length(digits) > 15
        OR digits LIKE '0%'
        OR digits ~ '^0+$'
        THEN NULL
      ELSE '+' || digits
    END AS normalized
  FROM with_country_prefix
), ranked_phone AS (
  SELECT
    "id",
    normalized,
    count(*) OVER (PARTITION BY normalized) AS duplicate_count
  FROM canonical_phone
  WHERE normalized IS NOT NULL
)
UPDATE "User" AS target
SET "phoneNormalized" = ranked.normalized
FROM ranked_phone AS ranked
WHERE target."id" = ranked."id"
  AND ranked.duplicate_count = 1;

CREATE UNIQUE INDEX "User_phoneNormalized_key"
ON "User"("phoneNormalized");

-- Administrators always retain an email login. A client must retain at least
-- one recoverable identifier after every write, including future migrations.
ALTER TABLE "User"
ADD CONSTRAINT "User_recovery_identifier_check"
CHECK (
  ("role" = 'ADMIN' AND "email" IS NOT NULL)
  OR
  ("role" = 'CLIENT' AND ("email" IS NOT NULL OR "phoneNormalized" IS NOT NULL))
);

-- Older code marked deliveredAt before calling Gmail. Invalidate every active
-- legacy link and supersede its queued payload so no pre-acceptance marker can
-- remain usable after this migration. A fresh request creates a fresh link.
UPDATE "PasswordResetToken"
SET
  "usedAt" = CURRENT_TIMESTAMP,
  "deliveredAt" = NULL
WHERE "usedAt" IS NULL;

UPDATE "PasswordEmailOutbox"
SET
  "status" = 'SUPERSEDED',
  "payloadCiphertext" = NULL,
  "payloadIv" = NULL,
  "payloadAuthTag" = NULL,
  "lockedAt" = NULL,
  "lastError" = 'Invalidé pendant la migration vers la preuve Gmail post-acceptation.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "kind" = 'PASSWORD_RESET'
  AND "status" IN ('PENDING', 'RETRY', 'PROCESSING');
