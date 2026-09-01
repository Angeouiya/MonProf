import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const JEKO_PAYMENT_STALE_MS = 20 * 60 * 1000;
const JEKO_PAYOUT_STALE_MS = 30 * 60 * 1000;
const PASSWORD_EMAIL_PROCESSING_STALE_MS = 10 * 60 * 1000;

type RiskStatus = "ok" | "attention" | "critical";

type CountRow = { count: number | bigint };

export type OperationalRiskRadar = {
  status: RiskStatus;
  checkedAt: string;
  thresholds: {
    jekoPaymentStaleMinutes: number;
    jekoPayoutStaleMinutes: number;
    passwordEmailProcessingStaleMinutes: number;
    recentWindowHours: number;
  };
  payments: {
    operationalBookingsWithoutVerifiedFunds: number;
    securedBookingsWithoutProviderProof: number;
    securedBookingsWithoutVerifiedTransaction: number;
    staleJekoPaymentAttempts: number;
    rejectedJekoEventsLast24h: number;
    failedJekoEventsLast24h: number;
    staleJekoPayouts: number;
    jekoPaymentIntegrityMismatches: number;
    jekoPayoutIntegrityMismatches: number;
  };
  passwordEmail: {
    dueJobs: number;
    retryJobs: number;
    staleProcessingJobs: number;
    failedJobsLast24h: number;
    ambiguousJobs: number;
  };
  summary: {
    criticalCount: number;
    attentionCount: number;
  };
};

/**
 * Radar opérationnel public-safe : aucun nom, email, téléphone, montant ou ID
 * métier ne sort d'ici. L'objectif est seulement de savoir si les flux
 * sensibles ont des travaux coincés ou suspects.
 */
export async function getOperationalRiskRadar(now = new Date()): Promise<OperationalRiskRadar> {
  const oneDayAgo = new Date(now.getTime() - DAY_MS);
  const stalePaymentBefore = new Date(now.getTime() - JEKO_PAYMENT_STALE_MS);
  const stalePayoutBefore = new Date(now.getTime() - JEKO_PAYOUT_STALE_MS);
  const stalePasswordEmailBefore = new Date(now.getTime() - PASSWORD_EMAIL_PROCESSING_STALE_MS);

  const [
    operationalBookingsWithoutVerifiedFunds,
    securedBookingsWithoutProviderProof,
    securedBookingsWithoutVerifiedTransaction,
    staleJekoPaymentAttempts,
    rejectedJekoEventsLast24h,
    failedJekoEventsLast24h,
    staleJekoPayouts,
    jekoPaymentIntegrityMismatches,
    jekoPayoutIntegrityMismatches,
    duePasswordEmailJobs,
    retryPasswordEmailJobs,
    stalePasswordEmailProcessingJobs,
    failedPasswordEmailJobsLast24h,
    ambiguousPasswordEmailJobs,
  ] = await Promise.all([
    countOperationalBookingsWithoutVerifiedFunds(),
    countSecuredBookingsWithoutProviderProof(),
    countSecuredBookingsWithoutVerifiedTransaction(),
    countStaleJekoPaymentAttempts(stalePaymentBefore),
    db.paymentEvent.count({
      where: { provider: "JEKO", status: "REJECTED", receivedAt: { gte: oneDayAgo } },
    }),
    db.paymentEvent.count({
      where: { provider: "JEKO", status: "FAILED", receivedAt: { gte: oneDayAgo } },
    }),
    countStaleJekoPayouts(stalePayoutBefore),
    countJekoPaymentIntegrityMismatches(),
    countJekoPayoutIntegrityMismatches(),
    db.passwordEmailOutbox.count({
      where: {
        status: { in: ["PENDING", "RETRY"] },
        availableAt: { lte: now },
        expiresAt: { gt: now },
      },
    }),
    db.passwordEmailOutbox.count({
      where: { status: "RETRY", expiresAt: { gt: now } },
    }),
    db.passwordEmailOutbox.count({
      where: { status: "PROCESSING", lockedAt: { lt: stalePasswordEmailBefore } },
    }),
    db.passwordEmailOutbox.count({
      where: { status: "FAILED", failedAt: { gte: oneDayAgo } },
    }),
    db.passwordEmailOutbox.count({
      where: {
        ambiguousAt: { not: null },
        status: { in: ["PENDING", "RETRY", "PROCESSING"] },
        expiresAt: { gt: now },
      },
    }),
  ]);

  const criticalCount =
    operationalBookingsWithoutVerifiedFunds
    + securedBookingsWithoutProviderProof
    + securedBookingsWithoutVerifiedTransaction
    + jekoPaymentIntegrityMismatches
    + jekoPayoutIntegrityMismatches
    + stalePasswordEmailProcessingJobs
    + failedPasswordEmailJobsLast24h;
  const attentionCount =
    staleJekoPaymentAttempts
    + rejectedJekoEventsLast24h
    + failedJekoEventsLast24h
    + staleJekoPayouts
    + duePasswordEmailJobs
    + retryPasswordEmailJobs
    + ambiguousPasswordEmailJobs;
  const status: RiskStatus = criticalCount > 0
    ? "critical"
    : attentionCount > 0
      ? "attention"
      : "ok";

  return {
    status,
    checkedAt: now.toISOString(),
    thresholds: {
      jekoPaymentStaleMinutes: Math.round(JEKO_PAYMENT_STALE_MS / 60_000),
      jekoPayoutStaleMinutes: Math.round(JEKO_PAYOUT_STALE_MS / 60_000),
      passwordEmailProcessingStaleMinutes: Math.round(PASSWORD_EMAIL_PROCESSING_STALE_MS / 60_000),
      recentWindowHours: Math.round(DAY_MS / (60 * 60 * 1000)),
    },
    payments: {
      operationalBookingsWithoutVerifiedFunds,
      securedBookingsWithoutProviderProof,
      securedBookingsWithoutVerifiedTransaction,
      staleJekoPaymentAttempts,
      rejectedJekoEventsLast24h,
      failedJekoEventsLast24h,
      staleJekoPayouts,
      jekoPaymentIntegrityMismatches,
      jekoPayoutIntegrityMismatches,
    },
    passwordEmail: {
      dueJobs: duePasswordEmailJobs,
      retryJobs: retryPasswordEmailJobs,
      staleProcessingJobs: stalePasswordEmailProcessingJobs,
      failedJobsLast24h: failedPasswordEmailJobsLast24h,
      ambiguousJobs: ambiguousPasswordEmailJobs,
    },
    summary: { criticalCount, attentionCount },
  };
}

async function countOperationalBookingsWithoutVerifiedFunds() {
  return firstCount(await db.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(*)::integer AS "count"
    FROM "Booking" AS booking
    WHERE booking."isQuoteOnly" = false
      AND booking."status" IN (
        'PAID',
        'PENDING_ADMIN_VALIDATION',
        'CONFIRMED',
        'ASSIGNED',
        'IN_PROGRESS',
        'COURSE_DONE',
        'PENDING_CLIENT_VALIDATION',
        'VALIDATED_BY_CLIENT',
        'PAYMENT_TO_RELEASE',
        'TEACHER_PAID'
      )
      AND booking."paymentStatus" NOT IN (
        'RECEIVED',
        'BLOCKED',
        'VALIDATED',
        'TO_PAY_TEACHER',
        'TEACHER_PAID',
        'DISPUTED',
        'REFUND_PENDING',
        'PARTIAL_REFUND_PENDING',
        'PARTIALLY_REFUNDED',
        'RETAINED'
      )
  `));
}

async function countSecuredBookingsWithoutProviderProof() {
  return firstCount(await db.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(*)::integer AS "count"
    FROM "Booking" AS booking
    WHERE booking."paymentStatus" IN (
        'RECEIVED',
        'BLOCKED',
        'VALIDATED',
        'TO_PAY_TEACHER',
        'TEACHER_PAID',
        'DISPUTED',
        'REFUND_PENDING',
        'PARTIAL_REFUND_PENDING',
        'PARTIALLY_REFUNDED',
        'RETAINED'
      )
      AND NOT (
        (
          booking."paymentProvider" = 'JEKO'
          AND UPPER(COALESCE(booking."providerPaymentStatus", '')) = 'SUCCESS'
          AND booking."paymentVerifiedAt" IS NOT NULL
        )
        OR (
          booking."paymentProvider" = 'PAYDUNYA'
          AND (
            (
              UPPER(COALESCE(booking."providerPaymentStatus", '')) = 'SUCCESS'
              AND booking."paymentVerifiedAt" IS NOT NULL
            )
            OR (
              UPPER(COALESCE(booking."paydunyaStatus", '')) = 'COMPLETED'
              AND booking."paydunyaVerifiedAt" IS NOT NULL
            )
          )
        )
      )
  `));
}

async function countSecuredBookingsWithoutVerifiedTransaction() {
  return firstCount(await db.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(*)::integer AS "count"
    FROM "Booking" AS booking
    WHERE booking."paymentStatus" IN (
        'RECEIVED',
        'BLOCKED',
        'VALIDATED',
        'TO_PAY_TEACHER',
        'TEACHER_PAID',
        'DISPUTED',
        'REFUND_PENDING',
        'PARTIAL_REFUND_PENDING',
        'PARTIALLY_REFUNDED',
        'RETAINED'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "Transaction" AS tx
        WHERE tx."bookingId" = booking."id"
          AND tx."type" = 'CLIENT_PAYMENT'
          AND tx."status" IN (
            'RECEIVED',
            'BLOCKED',
            'VALIDATED',
            'TO_PAY_TEACHER',
            'TEACHER_PAID',
            'DISPUTED',
            'REFUND_PENDING',
            'PARTIAL_REFUND_PENDING',
            'PARTIALLY_REFUNDED',
            'RETAINED'
          )
          AND tx."amount" = CASE
            WHEN booking."totalClientPays" > 0 THEN booking."totalClientPays"
            ELSE booking."totalPrice"
          END
      )
  `));
}

async function countStaleJekoPaymentAttempts(staleBefore: Date) {
  return firstCount(await db.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(*)::integer AS "count"
    FROM "PaymentAttempt" AS attempt
    WHERE attempt."provider" = 'JEKO'
      AND attempt."purpose" IN ('BOOKING', 'RESCHEDULE_FEE')
      AND (
        attempt."status" = 'REQUESTING'
        OR (
          attempt."status" = 'PENDING'
          AND attempt."providerOrderId" IS NOT NULL
        )
        OR (
          attempt."status" = 'FAILED'
          AND attempt."providerOrderId" IS NOT NULL
          AND attempt."failureCode" IS DISTINCT FROM 'JEKO_PAYMENT_FAILED'
        )
      )
      AND COALESCE(attempt."lastCheckedAt", attempt."updatedAt") <= ${staleBefore}
  `));
}

async function countStaleJekoPayouts(staleBefore: Date) {
  return firstCount(await db.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(*)::integer AS "count"
    FROM "TeacherPayoutRecord" AS payout
    WHERE payout."provider" = 'JEKO'
      AND payout."status" = 'DRAFT'
      AND COALESCE(payout."lastCheckedAt", payout."createdAt") <= ${staleBefore}
  `));
}

async function countJekoPaymentIntegrityMismatches() {
  return firstCount(await db.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(DISTINCT attempt."id")::integer AS "count"
    FROM "PaymentAttempt" AS attempt
    LEFT JOIN "Booking" AS booking ON booking."id" = attempt."bookingId"
    LEFT JOIN "Transaction" AS tx ON tx."id" = attempt."transactionId"
    WHERE attempt."provider" = 'JEKO'
      AND attempt."purpose" = 'BOOKING'
      AND attempt."status" = 'SUCCEEDED'
      AND (
        attempt."verifiedAt" IS NULL
        OR attempt."completedAt" IS NULL
        OR attempt."providerOrderId" IS NULL
        OR attempt."bookingId" IS NULL
        OR booking."id" IS NULL
        OR attempt."currency" <> 'XOF'
        OR attempt."providerAmountMinor" <> attempt."amountXof" * 100
        OR attempt."amountXof" <> CASE
          WHEN booking."totalClientPays" > 0 THEN booking."totalClientPays"
          ELSE booking."totalPrice"
        END
        OR tx."id" IS NULL
        OR tx."type" <> 'CLIENT_PAYMENT'
        OR tx."amount" <> attempt."amountXof"
      )
  `));
}

async function countJekoPayoutIntegrityMismatches() {
  return firstCount(await db.$queryRaw<CountRow[]>(Prisma.sql`
    WITH payout_totals AS (
      SELECT
        payout."id",
        COUNT(allocation."id")::integer AS allocation_count,
        COALESCE(SUM(allocation."amount"), 0)::bigint AS allocated_total
      FROM "TeacherPayoutRecord" AS payout
      LEFT JOIN "TeacherPayoutAllocation" AS allocation ON allocation."payoutId" = payout."id"
      WHERE payout."provider" = 'JEKO'
        AND payout."status" IN ('DRAFT', 'PAID')
      GROUP BY payout."id"
    )
    SELECT COUNT(DISTINCT payout."id")::integer AS "count"
    FROM "TeacherPayoutRecord" AS payout
    JOIN payout_totals AS totals ON totals."id" = payout."id"
    WHERE payout."provider" = 'JEKO'
      AND payout."status" IN ('DRAFT', 'PAID')
      AND (
        payout."amount" <= 0
        OR payout."providerReference" IS DISTINCT FROM payout."reference"
        OR totals.allocation_count = 0
        OR totals.allocated_total <> payout."amount"
        OR (
          payout."status" = 'PAID'
          AND (
            payout."paidAt" IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM "PaymentEvent" AS event
              WHERE event."provider" = 'JEKO'
                AND event."reference" = payout."reference"
                AND event."status" = 'PROCESSED'
            )
            OR EXISTS (
              SELECT 1
              FROM "TeacherPayoutAllocation" AS allocation
              LEFT JOIN "BookingSession" AS session ON session."id" = allocation."bookingSessionId"
              LEFT JOIN "Booking" AS booking ON booking."id" = allocation."bookingId"
              WHERE allocation."payoutId" = payout."id"
                AND (
                  (allocation."bookingSessionId" IS NOT NULL AND (
                    session."id" IS NULL
                    OR session."paidAmount" < allocation."paidAmountBefore" + allocation."amount"
                  ))
                  OR (allocation."bookingSessionId" IS NULL AND (
                    booking."id" IS NULL
                    OR booking."teacherPaidAmount" < allocation."paidAmountBefore" + allocation."amount"
                  ))
                )
            )
          )
        )
      )
  `));
}

function firstCount(rows: CountRow[]) {
  const count = rows[0]?.count ?? 0;
  return typeof count === "bigint" ? Number(count) : count;
}
