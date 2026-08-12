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

function firstCount(rows: CountRow[]) {
  const count = rows[0]?.count ?? 0;
  return typeof count === "bigint" ? Number(count) : count;
}
